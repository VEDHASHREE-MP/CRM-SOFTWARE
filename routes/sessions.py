from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import psycopg2.extras
from database import get_db
from datetime import datetime, timedelta

sessions_bp = Blueprint('sessions', __name__)


def get_cursor(db):
    return db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def is_admin(user_id):
    db  = get_db()
    cur = get_cursor(db)
    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()
    db.close()
    return user and user['role'] == 'admin'


def week_range(date_str):
    d      = datetime.strptime(date_str, '%Y-%m-%d')
    monday = d - timedelta(days=d.weekday())
    sunday = monday + timedelta(days=6)
    return monday.strftime('%Y-%m-%d'), sunday.strftime('%Y-%m-%d')


# ── Converted enquiries for booking dropdown ──────────────────────────────────

@sessions_bp.route('/converted-enquiries', methods=['GET'])
@jwt_required()
def get_converted_enquiries():
    db  = get_db()
    cur = get_cursor(db)
    cur.execute('''
        SELECT e.id, e.name, e.phone, e.service,
               (SELECT COUNT(*) FROM sessions s WHERE s.enquiry_id = e.id) AS session_count
        FROM enquiries e
        WHERE e.status = 'Converted'
        ORDER BY e.name
    ''')
    enquiries = cur.fetchall()
    db.close()
    return jsonify([dict(e) for e in enquiries]), 200


# ── Sessions CRUD ─────────────────────────────────────────────────────────────

@sessions_bp.route('/', methods=['GET'])
@jwt_required()
def get_sessions():
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()

    status_filter = request.args.get('status',    '')
    staff_filter  = request.args.get('staff',     '')
    date_from     = request.args.get('date_from', '')
    date_to       = request.args.get('date_to',   '')
    search        = request.args.get('search',    '')

    query = '''
        SELECT s.*, u.name AS staff_name, e.source AS enquiry_source
        FROM sessions s
        LEFT JOIN users u     ON s.assigned_staff = u.id
        LEFT JOIN enquiries e ON s.enquiry_id = e.id
        WHERE 1=1
    '''
    params = []

    if user['role'] == 'staff':
        query += ' AND s.assigned_staff = %s'
        params.append(user_id)

    if status_filter:
        query += ' AND s.status = %s'
        params.append(status_filter)

    if staff_filter and user['role'] == 'admin':
        query += ' AND s.assigned_staff = %s'
        params.append(staff_filter)

    if date_from:
        query += ' AND s.session_date >= %s'
        params.append(date_from)

    if date_to:
        query += ' AND s.session_date <= %s'
        params.append(date_to)

    if search:
        query += ' AND (s.customer_name ILIKE %s OR s.phone ILIKE %s OR s.service ILIKE %s)'
        params.extend([f'%{search}%', f'%{search}%', f'%{search}%'])

    query += ' ORDER BY s.session_date ASC, s.session_time ASC'

    cur.execute(query, params)
    sessions = cur.fetchall()
    db.close()
    return jsonify([dict(s) for s in sessions]), 200


@sessions_bp.route('/week', methods=['GET'])
@jwt_required()
def get_week_sessions():
    user_id  = get_jwt_identity()
    date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))

    try:
        monday, sunday = week_range(date_str)
    except ValueError:
        return jsonify({'error': 'Invalid date format'}), 400

    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()

    query  = '''
        SELECT s.*, u.name AS staff_name
        FROM sessions s
        LEFT JOIN users u ON s.assigned_staff = u.id
        WHERE s.session_date BETWEEN %s AND %s
    '''
    params = [monday, sunday]

    if user['role'] == 'staff':
        query += ' AND s.assigned_staff = %s'
        params.append(user_id)

    query += ' ORDER BY s.session_date ASC, s.session_time ASC'

    cur.execute(query, params)
    sessions = cur.fetchall()
    db.close()

    return jsonify({
        'week_start': monday,
        'week_end':   sunday,
        'sessions':   [dict(s) for s in sessions]
    }), 200


@sessions_bp.route('/<int:session_id>', methods=['GET'])
@jwt_required()
def get_session(session_id):
    db  = get_db()
    cur = get_cursor(db)
    cur.execute('''
        SELECT s.*, u.name AS staff_name, e.source AS enquiry_source
        FROM sessions s
        LEFT JOIN users u     ON s.assigned_staff = u.id
        LEFT JOIN enquiries e ON s.enquiry_id = e.id
        WHERE s.id = %s
    ''', (session_id,))
    session = cur.fetchone()
    db.close()

    if not session:
        return jsonify({'error': 'Session not found'}), 404

    return jsonify(dict(session)), 200


@sessions_bp.route('/', methods=['POST'])
@jwt_required()
def create_session():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()

    enquiry_id       = data.get('enquiry_id') or None
    team_id          = data.get('team_id') or None
    customer_name    = data.get('customer_name',    '').strip()
    phone            = data.get('phone',            '').strip()
    service          = data.get('service',          '').strip()
    session_date     = data.get('session_date',     '').strip()
    session_time     = data.get('session_time',     '').strip()
    duration         = data.get('duration',         '').strip()
    mode             = data.get('mode',             'offline').strip()
    location_or_link = (data.get('location_or_link') or '').strip()
    notes            = (data.get('notes')           or '').strip()
    assigned_staff   = data.get('assigned_staff') or None
    member_ids       = data.get('member_ids', [])   # for team sessions

    # phone is optional for team sessions (teams don't have a single contact number)
    required_fields = [customer_name, service, session_date, session_time, duration]
    if not team_id:
        required_fields.append(phone)
    if not all(required_fields):
        return jsonify({'error': 'customer_name, service, session_date, session_time, duration are required (phone also required for non-team sessions)'}), 400

    db  = get_db()
    cur = get_cursor(db)

    if enquiry_id:
        cur.execute(
            "SELECT id FROM enquiries WHERE id = %s AND status = 'Converted'",
            (enquiry_id,)
        )
        if not cur.fetchone():
            db.close()
            return jsonify({'error': 'The selected enquiry is not marked as Converted'}), 400

    if team_id:
        cur.execute(
            "SELECT id FROM team_enquiries WHERE id = %s AND status = 'Converted'",
            (team_id,)
        )
        if not cur.fetchone():
            db.close()
            return jsonify({'error': 'The selected team is not marked as Converted'}), 400

    cur.execute('''
        INSERT INTO sessions
            (enquiry_id, team_id, customer_name, phone, service, session_date, session_time,
             duration, mode, location_or_link, notes, assigned_staff, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Scheduled')
        RETURNING id
    ''', (enquiry_id, team_id, customer_name, phone, service, session_date, session_time,
          duration, mode, location_or_link or None, notes or None, assigned_staff))

    session_id = cur.fetchone()['id']

    # Link selected team members to this session
    for mid in member_ids:
        try:
            cur.execute(
                'INSERT INTO session_members (session_id, member_id) VALUES (%s, %s) ON CONFLICT DO NOTHING',
                (session_id, mid)
            )
        except Exception:
            pass

    if assigned_staff:
        cur.execute('''
            INSERT INTO notifications (user_id, message, type, session_id)
            VALUES (%s, %s, 'session_assigned', %s)
        ''', (assigned_staff,
              f"New session assigned: {customer_name} on {session_date} at {session_time}",
              session_id))

    db.commit()

    cur.execute('''
        SELECT s.*, u.name AS staff_name
        FROM sessions s LEFT JOIN users u ON s.assigned_staff = u.id
        WHERE s.id = %s
    ''', (session_id,))
    session = cur.fetchone()
    db.close()

    return jsonify({'message': 'Session created', 'session': dict(session)}), 201


@sessions_bp.route('/<int:session_id>', methods=['PUT'])
@jwt_required()
def update_session(session_id):
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT * FROM sessions WHERE id = %s', (session_id,))
    existing = cur.fetchone()
    if not existing:
        db.close()
        return jsonify({'error': 'Session not found'}), 404

    data = request.get_json()

    customer_name    = data.get('customer_name',    existing['customer_name'])
    phone            = data.get('phone',            existing['phone'])
    service          = data.get('service',          existing['service'])
    session_date     = data.get('session_date',     existing['session_date'])
    session_time     = data.get('session_time',     existing['session_time'])
    duration         = data.get('duration',         existing['duration'])
    mode             = data.get('mode',             existing['mode'])
    location_or_link = data.get('location_or_link', existing['location_or_link']) or None
    notes            = data.get('notes',            existing['notes']) or None
    assigned_staff   = data.get('assigned_staff',   existing['assigned_staff']) or None
    status           = data.get('status',           existing['status'])

    valid_statuses = ['Scheduled', 'Completed', 'Cancelled']
    if status not in valid_statuses:
        db.close()
        return jsonify({'error': f'Status must be one of {valid_statuses}'}), 400

    cur.execute('''
        UPDATE sessions SET
            customer_name=%s, phone=%s, service=%s, session_date=%s, session_time=%s,
            duration=%s, mode=%s, location_or_link=%s, notes=%s, assigned_staff=%s,
            status=%s, updated_at=NOW()
        WHERE id=%s
    ''', (customer_name, phone, service, session_date, session_time,
          duration, mode, location_or_link, notes, assigned_staff, status, session_id))

    if assigned_staff and assigned_staff != existing['assigned_staff']:
        cur.execute('''
            INSERT INTO notifications (user_id, message, type, session_id)
            VALUES (%s, %s, 'session_assigned', %s)
        ''', (assigned_staff,
              f"Session reassigned to you: {customer_name} on {session_date} at {session_time}",
              session_id))

    db.commit()

    cur.execute('''
        SELECT s.*, u.name AS staff_name
        FROM sessions s LEFT JOIN users u ON s.assigned_staff = u.id
        WHERE s.id = %s
    ''', (session_id,))
    updated = cur.fetchone()
    db.close()

    return jsonify({'message': 'Session updated', 'session': dict(updated)}), 200


@sessions_bp.route('/<int:session_id>/status', methods=['PATCH'])
@jwt_required()
def update_status(session_id):
    data   = request.get_json()
    status = data.get('status', '')

    valid_statuses = ['Scheduled', 'Completed', 'Cancelled']
    if status not in valid_statuses:
        return jsonify({'error': 'Invalid status'}), 400

    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT id FROM sessions WHERE id = %s', (session_id,))
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Session not found'}), 404

    cur.execute(
        "UPDATE sessions SET status=%s, updated_at=NOW() WHERE id=%s",
        (status, session_id)
    )
    db.commit()
    db.close()

    return jsonify({'message': 'Status updated', 'status': status}), 200


@sessions_bp.route('/<int:session_id>', methods=['DELETE'])
@jwt_required()
def delete_session(session_id):
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db  = get_db()
    cur = get_cursor(db)
    cur.execute('DELETE FROM sessions WHERE id = %s', (session_id,))
    db.commit()
    db.close()

    return jsonify({'message': 'Session deleted'}), 200


# ── Session member management ─────────────────────────────────────────────────

@sessions_bp.route('/<int:session_id>/members', methods=['GET'])
@jwt_required()
def get_session_members(session_id):
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT id, team_id FROM sessions WHERE id = %s', (session_id,))
    session = cur.fetchone()
    if not session:
        db.close()
        return jsonify({'error': 'Session not found'}), 404

    # Current attendees
    cur.execute('''
        SELECT tem.*
        FROM session_members sm
        JOIN team_enquiry_members tem ON tem.id = sm.member_id
        WHERE sm.session_id = %s
        ORDER BY tem.name
    ''', (session_id,))
    attending = [dict(m) for m in cur.fetchall()]

    # Remaining members of the team not yet in this session
    remaining = []
    if session['team_id']:
        cur.execute('''
            SELECT tem.*
            FROM team_enquiry_members tem
            WHERE tem.team_id = %s
              AND tem.id NOT IN (
                  SELECT member_id FROM session_members WHERE session_id = %s
              )
            ORDER BY tem.name
        ''', (session['team_id'], session_id))
        remaining = [dict(m) for m in cur.fetchall()]

    db.close()
    return jsonify({'attending': attending, 'remaining': remaining}), 200


@sessions_bp.route('/<int:session_id>/members', methods=['POST'])
@jwt_required()
def add_session_member(session_id):
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    data      = request.get_json()
    member_id = data.get('member_id')
    if not member_id:
        return jsonify({'error': 'member_id required'}), 400

    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT id FROM sessions WHERE id = %s', (session_id,))
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Session not found'}), 404

    cur.execute('SELECT id FROM team_enquiry_members WHERE id = %s', (member_id,))
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Member not found'}), 404

    try:
        cur.execute(
            'INSERT INTO session_members (session_id, member_id) VALUES (%s, %s)',
            (session_id, member_id)
        )
        db.commit()
    except Exception:
        db.rollback()
        db.close()
        return jsonify({'error': 'Member already in this session'}), 409

    db.close()
    return jsonify({'message': 'Member added to session'}), 201


@sessions_bp.route('/<int:session_id>/members/<int:member_id>', methods=['DELETE'])
@jwt_required()
def remove_session_member(session_id, member_id):
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db  = get_db()
    cur = get_cursor(db)

    cur.execute(
        'DELETE FROM session_members WHERE session_id=%s AND member_id=%s',
        (session_id, member_id)
    )
    if cur.rowcount == 0:
        db.close()
        return jsonify({'error': 'Member not found in this session'}), 404

    db.commit()
    db.close()
    return jsonify({'message': 'Member removed from session'}), 200


# ── Today / upcoming ─────────────────────────────────────────────────────────

@sessions_bp.route('/due-today', methods=['GET'])
@jwt_required()
def due_today():
    user_id = get_jwt_identity()
    today   = datetime.now().strftime('%Y-%m-%d')
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()

    if user['role'] == 'admin':
        cur.execute('''
            SELECT s.*, u.name AS staff_name FROM sessions s
            LEFT JOIN users u ON s.assigned_staff = u.id
            WHERE s.session_date = %s AND s.status = 'Scheduled'
        ''', (today,))
    else:
        cur.execute('''
            SELECT s.*, u.name AS staff_name FROM sessions s
            LEFT JOIN users u ON s.assigned_staff = u.id
            WHERE s.session_date = %s AND s.status = 'Scheduled'
              AND s.assigned_staff = %s
        ''', (today, user_id))

    sessions = cur.fetchall()
    db.close()
    return jsonify([dict(s) for s in sessions]), 200


# ── Stats ──────────────────────────────────────────────────────────────────────

@sessions_bp.route('/stats/summary', methods=['GET'])
@jwt_required()
def stats():
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    user  = cur.fetchone()
    today = datetime.now().strftime('%Y-%m-%d')

    if user['role'] == 'admin':
        base_query  = 'FROM sessions WHERE 1=1'
        params_base = []
    else:
        base_query  = 'FROM sessions WHERE assigned_staff = %s'
        params_base = [user_id]

    def count(extra_where, extra_params=[]):
        cur.execute(f'SELECT COUNT(*) AS c {base_query} AND {extra_where}',
                    params_base + extra_params)
        return cur.fetchone()['c']

    cur.execute(f'SELECT COUNT(*) AS c {base_query}', params_base)
    total = cur.fetchone()['c']

    scheduled = count("status = %s", ['Scheduled'])
    completed = count("status = %s", ['Completed'])
    cancelled = count("status = %s", ['Cancelled'])
    today_count = count("session_date = %s", [today])

    db.close()
    return jsonify({
        'total':     total,
        'scheduled': scheduled,
        'completed': completed,
        'cancelled': cancelled,
        'today':     today_count
    }), 200

# ── Send Session Confirmation Email ──────────────────────────────────────────

@sessions_bp.route('/<int:session_id>/send-email', methods=['POST'])
@jwt_required()
def send_session_email_route(session_id):
    """
    Manually triggered when admin clicks 'Send Email' on a session.
    Sends session confirmation details to the customer's email.
    """
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('''
        SELECT s.*, u.name AS staff_name
        FROM sessions s
        LEFT JOIN users u ON s.assigned_staff = u.id
        WHERE s.id = %s
    ''', (session_id,))
    session = cur.fetchone()

    if not session:
        db.close()
        return jsonify({'error': 'Session not found'}), 404

    data           = request.get_json()
    customer_email = data.get('customer_email', '').strip()

    if not customer_email:
        db.close()
        return jsonify({'error': 'Customer email is required'}), 400

    # Save email on the session for next time
    if not session.get('customer_email'):
        try:
            cur.execute(
                'UPDATE sessions SET customer_email = %s WHERE id = %s',
                (customer_email, session_id)
            )
            db.commit()
        except Exception:
            pass   # column may not exist yet — migration will fix on restart

    db.close()

    from email_service import send_session_email
    result = send_session_email(
        session        = dict(session),
        customer_email = customer_email,
    )

    if result['customer']:
        return jsonify({
            'message': f'Session details emailed to {customer_email}',
            'result':  result,
        }), 200
    else:
        return jsonify({'error': 'Failed to send email. Check server logs.'}), 500