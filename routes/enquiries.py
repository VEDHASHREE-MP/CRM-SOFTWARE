from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import psycopg2.extras
from database import get_db
from datetime import datetime
from whatsapp import (
    notify_admin_new_enquiry,
    notify_admin_status_change,
    notify_admin_followup_due,
    message_customer_enquiry_received,
)

enquiries_bp = Blueprint('enquiries', __name__)


def get_cursor(db):
    return db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def create_followup_notification(db, enquiry_id, enquiry_name, follow_up_date, assigned_to, current_user_id):
    cur = get_cursor(db)
    if follow_up_date and assigned_to:
        cur.execute('''
            INSERT INTO notifications (user_id, message, type, enquiry_id)
            VALUES (%s, %s, 'reminder', %s)
        ''', (
            assigned_to,
            f"Follow-up reminder for enquiry: {enquiry_name} on {follow_up_date}",
            enquiry_id
        ))
    if assigned_to and int(assigned_to) != int(current_user_id):
        cur.execute('''
            INSERT INTO notifications (user_id, message, type, enquiry_id)
            VALUES (%s, %s, 'assignment', %s)
        ''', (
            assigned_to,
            f"New enquiry assigned to you: {enquiry_name}",
            enquiry_id
        ))


@enquiries_bp.route('/', methods=['GET'])
@jwt_required()
def get_enquiries():
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()

    status_filter   = request.args.get('status', '')
    search          = request.args.get('search', '')
    assigned_filter = request.args.get('assigned_to', '')
    date_from       = request.args.get('date_from', '')
    date_to         = request.args.get('date_to', '')

    query = '''
        SELECT e.*, u.name as assigned_to_name
        FROM enquiries e
        LEFT JOIN users u ON e.assigned_to = u.id
        WHERE 1=1
    '''
    params = []

    if user['role'] == 'staff':
        query += ' AND e.assigned_to = %s'
        params.append(user_id)

    if status_filter:
        query += ' AND e.status = %s'
        params.append(status_filter)

    if search:
        query += ' AND (e.name ILIKE %s OR e.phone ILIKE %s OR e.service ILIKE %s)'
        params.extend([f'%{search}%', f'%{search}%', f'%{search}%'])

    if assigned_filter and user['role'] == 'admin':
        query += ' AND e.assigned_to = %s'
        params.append(assigned_filter)

    if date_from:
        query += ' AND e.created_at::date >= %s'
        params.append(date_from)

    if date_to:
        query += ' AND e.created_at::date <= %s'
        params.append(date_to)

    query += ' ORDER BY e.created_at DESC'

    cur.execute(query, params)
    enquiries = cur.fetchall()
    db.close()
    return jsonify([dict(e) for e in enquiries]), 200


@enquiries_bp.route('/<int:enquiry_id>', methods=['GET'])
@jwt_required()
def get_enquiry(enquiry_id):
    db  = get_db()
    cur = get_cursor(db)
    cur.execute('''
        SELECT e.*, u.name as assigned_to_name
        FROM enquiries e
        LEFT JOIN users u ON e.assigned_to = u.id
        WHERE e.id = %s
    ''', (enquiry_id,))
    enquiry = cur.fetchone()
    db.close()

    if not enquiry:
        return jsonify({'error': 'Enquiry not found'}), 404

    return jsonify(dict(enquiry)), 200


@enquiries_bp.route('/', methods=['POST'])
@jwt_required()
def create_enquiry():
    user_id = get_jwt_identity()
    data    = request.get_json()

    name           = data.get('name',           '').strip()
    phone          = data.get('phone',          '').strip()
    service        = data.get('service',        '').strip()
    source         = data.get('source',         '').strip()
    notes          = data.get('notes',          '').strip()
    follow_up_date = data.get('follow_up_date', '')
    assigned_to    = data.get('assigned_to') or None

    if not all([name, phone, service, source]):
        return jsonify({'error': 'Name, phone, service, and source are required'}), 400

    db  = get_db()
    cur = get_cursor(db)

    cur.execute('''
        INSERT INTO enquiries (name, phone, service, source, notes, follow_up_date, assigned_to, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'New')
        RETURNING id
    ''', (name, phone, service, source, notes, follow_up_date or None, assigned_to))

    enquiry_id = cur.fetchone()['id']

    if assigned_to:
        create_followup_notification(db, enquiry_id, name, follow_up_date, assigned_to, user_id)

    db.commit()

    cur.execute('''
        SELECT e.*, u.name as assigned_to_name
        FROM enquiries e LEFT JOIN users u ON e.assigned_to = u.id
        WHERE e.id = %s
    ''', (enquiry_id,))
    enquiry = cur.fetchone()
    db.close()

    # WhatsApp notifications (non-blocking)
    try:
        notify_admin_new_enquiry(name, phone, service, source)
        message_customer_enquiry_received(name, phone, service)
        if follow_up_date:
            notify_admin_followup_due(name, phone, service, follow_up_date)
    except Exception as _e:
        print(f"WhatsApp error (create_enquiry): {_e}")

    return jsonify({'message': 'Enquiry created', 'enquiry': dict(enquiry)}), 201


@enquiries_bp.route('/<int:enquiry_id>', methods=['PUT'])
@jwt_required()
def update_enquiry(enquiry_id):
    user_id = get_jwt_identity()
    data    = request.get_json()

    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT * FROM enquiries WHERE id = %s', (enquiry_id,))
    existing = cur.fetchone()
    if not existing:
        db.close()
        return jsonify({'error': 'Enquiry not found'}), 404

    name           = data.get('name',           existing['name']).strip()
    phone          = data.get('phone',          existing['phone']).strip()
    service        = data.get('service',        existing['service']).strip()
    source         = data.get('source',         existing['source']).strip()
    status         = data.get('status',         existing['status'])
    notes          = data.get('notes',          existing['notes'] or '')
    follow_up_date = data.get('follow_up_date', existing['follow_up_date'])
    assigned_to    = data.get('assigned_to',    existing['assigned_to'])

    valid_statuses = ['New', 'Follow-up', 'Converted', 'Closed']
    if status not in valid_statuses:
        db.close()
        return jsonify({'error': f'Status must be one of {valid_statuses}'}), 400

    cur.execute('''
        UPDATE enquiries
        SET name=%s, phone=%s, service=%s, source=%s, status=%s, notes=%s,
            follow_up_date=%s, assigned_to=%s, updated_at=NOW()
        WHERE id=%s
    ''', (name, phone, service, source, status, notes,
          follow_up_date or None, assigned_to or None, enquiry_id))

    if assigned_to and assigned_to != existing['assigned_to']:
        cur.execute('''
            INSERT INTO notifications (user_id, message, type, enquiry_id)
            VALUES (%s, %s, 'assignment', %s)
        ''', (assigned_to, f"Enquiry assigned to you: {name}", enquiry_id))

    db.commit()

    cur.execute('''
        SELECT e.*, u.name as assigned_to_name
        FROM enquiries e LEFT JOIN users u ON e.assigned_to = u.id
        WHERE e.id = %s
    ''', (enquiry_id,))
    updated = cur.fetchone()
    db.close()

    # WhatsApp notifications (non-blocking)
    try:
        old_status = existing['status']
        if status != old_status:
            notify_admin_status_change(name, phone, service, old_status, status)
        if follow_up_date and follow_up_date != existing['follow_up_date']:
            notify_admin_followup_due(name, phone, service, follow_up_date)
    except Exception as _e:
        print(f"WhatsApp error (update_enquiry): {_e}")

    return jsonify({'message': 'Enquiry updated', 'enquiry': dict(updated)}), 200


@enquiries_bp.route('/<int:enquiry_id>/status', methods=['PATCH'])
@jwt_required()
def update_status(enquiry_id):
    data   = request.get_json()
    status = data.get('status', '')

    valid_statuses = ['New', 'Follow-up', 'Converted', 'Closed']
    if status not in valid_statuses:
        return jsonify({'error': 'Invalid status'}), 400

    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT id FROM enquiries WHERE id = %s', (enquiry_id,))
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Enquiry not found'}), 404

    cur.execute('SELECT name, phone, service, status FROM enquiries WHERE id = %s', (enquiry_id,))
    enq = cur.fetchone()

    cur.execute(
        "UPDATE enquiries SET status=%s, updated_at=NOW() WHERE id=%s",
        (status, enquiry_id)
    )
    db.commit()
    db.close()

    # WhatsApp notification (non-blocking)
    try:
        if enq:
            notify_admin_status_change(enq['name'], enq['phone'], enq['service'], enq['status'], status)
    except Exception as _e:
        print(f"WhatsApp error (update_status): {_e}")

    return jsonify({'message': 'Status updated', 'status': status}), 200


@enquiries_bp.route('/<int:enquiry_id>', methods=['DELETE'])
@jwt_required()
def delete_enquiry(enquiry_id):
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()

    if user['role'] != 'admin':
        db.close()
        return jsonify({'error': 'Admin access required'}), 403

    cur.execute('SELECT id FROM enquiries WHERE id = %s', (enquiry_id,))
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Enquiry not found'}), 404

    # Remove child rows that block the delete due to FK constraints
    # 1. notifications reference enquiry_id (no ON DELETE action)
    cur.execute('DELETE FROM notifications WHERE enquiry_id = %s', (enquiry_id,))

    # 2. sessions reference enquiry_id NOT NULL (no cascade)
    #    First null-out any invoice links to those sessions, then delete sessions
    cur.execute('SELECT id FROM sessions WHERE enquiry_id = %s', (enquiry_id,))
    session_ids = [r['id'] for r in cur.fetchall()]
    if session_ids:
        cur.execute(
            'UPDATE invoices SET session_id = NULL WHERE session_id = ANY(%s)',
            (session_ids,)
        )
        cur.execute('DELETE FROM sessions WHERE enquiry_id = %s', (enquiry_id,))

    # 3. invoices already have ON DELETE SET NULL — PostgreSQL handles automatically
    # 4. Now safe to delete the enquiry
    cur.execute('DELETE FROM enquiries WHERE id = %s', (enquiry_id,))
    db.commit()
    db.close()

    return jsonify({'message': 'Enquiry deleted'}), 200


# ── Notifications ─────────────────────────────────────────────────────────────

@enquiries_bp.route('/notifications/all', methods=['GET'])
@jwt_required()
def get_notifications():
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)
    cur.execute('''
        SELECT n.*, e.name as enquiry_name
        FROM notifications n
        LEFT JOIN enquiries e ON n.enquiry_id = e.id
        WHERE n.user_id = %s
        ORDER BY n.created_at DESC
        LIMIT 50
    ''', (user_id,))
    notifications = cur.fetchall()
    db.close()
    return jsonify([dict(n) for n in notifications]), 200


@enquiries_bp.route('/notifications/due-today', methods=['GET'])
@jwt_required()
def get_due_today():
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()

    today = datetime.now().strftime('%Y-%m-%d')

    if user['role'] == 'admin':
        cur.execute('''
            SELECT e.*, u.name as assigned_to_name
            FROM enquiries e
            LEFT JOIN users u ON e.assigned_to = u.id
            WHERE e.follow_up_date::date = %s
              AND e.status NOT IN ('Converted', 'Closed')
        ''', (today,))
    else:
        cur.execute('''
            SELECT e.*, u.name as assigned_to_name
            FROM enquiries e
            LEFT JOIN users u ON e.assigned_to = u.id
            WHERE e.follow_up_date::date = %s
              AND e.assigned_to = %s
              AND e.status NOT IN ('Converted', 'Closed')
        ''', (today, user_id))

    due = cur.fetchall()
    db.close()
    return jsonify([dict(d) for d in due]), 200


@enquiries_bp.route('/notifications/<int:notif_id>/read', methods=['PATCH'])
@jwt_required()
def mark_read(notif_id):
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)
    cur.execute(
        'UPDATE notifications SET is_read = 1 WHERE id = %s AND user_id = %s',
        (notif_id, user_id)
    )
    db.commit()
    db.close()
    return jsonify({'message': 'Marked as read'}), 200


@enquiries_bp.route('/notifications/mark-all-read', methods=['PATCH'])
@jwt_required()
def mark_all_read():
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)
    cur.execute('UPDATE notifications SET is_read = 1 WHERE user_id = %s', (user_id,))
    db.commit()
    db.close()
    return jsonify({'message': 'All marked as read'}), 200


# ── Stats ─────────────────────────────────────────────────────────────────────

@enquiries_bp.route('/stats/summary', methods=['GET'])
@jwt_required()
def get_stats():
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()

    if user['role'] == 'admin':
        base_query = 'FROM enquiries WHERE 1=1'
        params_base = []
    else:
        base_query = 'FROM enquiries WHERE assigned_to = %s'
        params_base = [user_id]

    and_clause = 'AND' if params_base else 'AND'

    def count(extra_where, extra_params=[]):
        cur.execute(f'SELECT COUNT(*) AS c {base_query} {and_clause} {extra_where}',
                    params_base + extra_params)
        return cur.fetchone()['c']

    cur.execute(f'SELECT COUNT(*) AS c {base_query}', params_base)
    total = cur.fetchone()['c']

    new_count       = count("status = %s", ['New'])
    followup_count  = count("status = %s", ['Follow-up'])
    converted_count = count("status = %s", ['Converted'])
    closed_count    = count("status = %s", ['Closed'])

    db.close()
    return jsonify({
        'total':           total,
        'new':             new_count,
        'follow_up':       followup_count,
        'converted':       converted_count,
        'closed':          closed_count,
        'conversion_rate': round((converted_count / total * 100), 1) if total else 0
    }), 200