"""
routes/team_enquiries.py
Handles team enquiries (parallel to individual enquiries).
Each team_enquiry has N team_enquiry_members.
"""

import csv
import io
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import psycopg2.extras
from database import get_db

team_enquiries_bp = Blueprint('team_enquiries', __name__)


def get_cursor(db):
    return db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fetch_team(cur, team_id):
    cur.execute('''
        SELECT te.*, u.name AS assigned_to_name,
               COUNT(tem.id) AS member_count
        FROM team_enquiries te
        LEFT JOIN users u                ON te.assigned_to = u.id
        LEFT JOIN team_enquiry_members tem ON tem.team_id = te.id
        WHERE te.id = %s
        GROUP BY te.id, u.name
    ''', (team_id,))
    team = cur.fetchone()
    if not team:
        return None
    cur.execute(
        'SELECT * FROM team_enquiry_members WHERE team_id = %s ORDER BY id',
        (team_id,)
    )
    members = cur.fetchall()
    result = dict(team)
    result['members'] = [dict(m) for m in members]
    return result


# ── List / create teams ───────────────────────────────────────────────────────

@team_enquiries_bp.route('/', methods=['GET'])
@jwt_required()
def list_teams():
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()

    status_filter = request.args.get('status', '')
    search        = request.args.get('search', '')

    query = '''
        SELECT te.*, u.name AS assigned_to_name,
               COUNT(tem.id) AS member_count
        FROM team_enquiries te
        LEFT JOIN users u                  ON te.assigned_to = u.id
        LEFT JOIN team_enquiry_members tem ON tem.team_id = te.id
        WHERE 1=1
    '''
    params = []

    if user['role'] == 'staff':
        query += ' AND te.assigned_to = %s'
        params.append(user_id)

    if status_filter:
        query += ' AND te.status = %s'
        params.append(status_filter)

    if search:
        query += ' AND te.team_name ILIKE %s'
        params.append(f'%{search}%')

    query += ' GROUP BY te.id, u.name ORDER BY te.created_at DESC'

    cur.execute(query, params)
    teams = cur.fetchall()

    # Fetch members for each team so the frontend can display them when expanded
    result = []
    for team in teams:
        row = dict(team)
        cur.execute(
            'SELECT * FROM team_enquiry_members WHERE team_id = %s ORDER BY id',
            (team['id'],)
        )
        row['members'] = [dict(m) for m in cur.fetchall()]
        result.append(row)

    db.close()
    return jsonify(result), 200


@team_enquiries_bp.route('/<int:team_id>', methods=['GET'])
@jwt_required()
def get_team(team_id):
    db  = get_db()
    cur = get_cursor(db)
    team = _fetch_team(cur, team_id)
    db.close()
    if not team:
        return jsonify({'error': 'Team not found'}), 404
    return jsonify(team), 200


@team_enquiries_bp.route('/', methods=['POST'])
@jwt_required()
def create_team():
    user_id = get_jwt_identity()
    data    = request.get_json()

    team_name   = (data.get('team_name') or '').strip()
    service     = (data.get('service')   or '').strip()
    source      = (data.get('source')    or 'Walk-in').strip()
    notes       = (data.get('notes')     or '').strip()
    assigned_to = data.get('assigned_to') or None
    members_raw = data.get('members', [])   # list of {name, phone, email}

    if not team_name or not service:
        return jsonify({'error': 'team_name and service are required'}), 400

    if not members_raw:
        return jsonify({'error': 'At least one member is required'}), 400

    db  = get_db()
    cur = get_cursor(db)

    cur.execute('''
        INSERT INTO team_enquiries (team_name, service, source, notes, assigned_to, status)
        VALUES (%s, %s, %s, %s, %s, 'New')
        RETURNING id
    ''', (team_name, service, source, notes or None, assigned_to))
    team_id = cur.fetchone()['id']

    for m in members_raw:
        name  = (m.get('name')  or '').strip()
        phone = (m.get('phone') or '').strip()
        email = (m.get('email') or '').strip()
        if not name:
            continue
        cur.execute('''
            INSERT INTO team_enquiry_members (team_id, name, phone, email)
            VALUES (%s, %s, %s, %s)
        ''', (team_id, name, phone or None, email or None))

    db.commit()
    team = _fetch_team(cur, team_id)
    db.close()
    return jsonify({'message': 'Team created', 'team': team}), 201


@team_enquiries_bp.route('/<int:team_id>', methods=['PUT'])
@jwt_required()
def update_team(team_id):
    data = request.get_json()
    db   = get_db()
    cur  = get_cursor(db)

    cur.execute('SELECT * FROM team_enquiries WHERE id = %s', (team_id,))
    existing = cur.fetchone()
    if not existing:
        db.close()
        return jsonify({'error': 'Team not found'}), 404

    team_name   = (data.get('team_name') or existing['team_name']).strip()
    service     = (data.get('service')   or existing['service']).strip()
    source      = (data.get('source')    or existing['source']).strip()
    notes       = data.get('notes',      existing['notes'])
    status      = data.get('status',     existing['status'])
    assigned_to = data.get('assigned_to', existing['assigned_to']) or None

    valid_statuses = ['New', 'Follow-up', 'Converted', 'Closed']
    if status not in valid_statuses:
        db.close()
        return jsonify({'error': f'Status must be one of {valid_statuses}'}), 400

    cur.execute('''
        UPDATE team_enquiries
        SET team_name=%s, service=%s, source=%s, notes=%s, status=%s,
            assigned_to=%s, updated_at=NOW()
        WHERE id=%s
    ''', (team_name, service, source, notes, status, assigned_to, team_id))

    db.commit()
    team = _fetch_team(cur, team_id)
    db.close()
    return jsonify({'message': 'Team updated', 'team': team}), 200


@team_enquiries_bp.route('/<int:team_id>/status', methods=['PATCH'])
@jwt_required()
def update_team_status(team_id):
    data   = request.get_json()
    status = data.get('status', '')

    valid_statuses = ['New', 'Follow-up', 'Converted', 'Closed']
    if status not in valid_statuses:
        return jsonify({'error': 'Invalid status'}), 400

    db  = get_db()
    cur = get_cursor(db)
    cur.execute('SELECT id FROM team_enquiries WHERE id = %s', (team_id,))
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Team not found'}), 404

    cur.execute(
        'UPDATE team_enquiries SET status=%s, updated_at=NOW() WHERE id=%s',
        (status, team_id)
    )
    db.commit()
    db.close()
    return jsonify({'message': 'Status updated', 'status': status}), 200


@team_enquiries_bp.route('/<int:team_id>', methods=['DELETE'])
@jwt_required()
def delete_team(team_id):
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()
    if user['role'] != 'admin':
        db.close()
        return jsonify({'error': 'Admin access required'}), 403

    cur.execute('SELECT id FROM team_enquiries WHERE id = %s', (team_id,))
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Team not found'}), 404

    # Cascade: team_enquiry_members + session_members handled by FK ON DELETE CASCADE
    cur.execute('DELETE FROM team_enquiries WHERE id = %s', (team_id,))
    db.commit()
    db.close()
    return jsonify({'message': 'Team deleted'}), 200


# ── Member management ─────────────────────────────────────────────────────────

@team_enquiries_bp.route('/<int:team_id>/members', methods=['POST'])
@jwt_required()
def add_member(team_id):
    data  = request.get_json()
    name  = (data.get('name')  or '').strip()
    phone = (data.get('phone') or '').strip()
    email = (data.get('email') or '').strip()

    if not name:
        return jsonify({'error': 'name is required'}), 400

    db  = get_db()
    cur = get_cursor(db)
    cur.execute('SELECT id FROM team_enquiries WHERE id = %s', (team_id,))
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Team not found'}), 404

    cur.execute('''
        INSERT INTO team_enquiry_members (team_id, name, phone, email)
        VALUES (%s, %s, %s, %s)
        RETURNING *
    ''', (team_id, name, phone or None, email or None))
    member = dict(cur.fetchone())
    db.commit()
    db.close()
    return jsonify({'message': 'Member added', 'member': member}), 201


@team_enquiries_bp.route('/<int:team_id>/members/<int:member_id>', methods=['DELETE'])
@jwt_required()
def remove_member(team_id, member_id):
    db  = get_db()
    cur = get_cursor(db)

    cur.execute(
        'SELECT id FROM team_enquiry_members WHERE id=%s AND team_id=%s',
        (member_id, team_id)
    )
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Member not found'}), 404

    # Check team won't become empty
    cur.execute(
        'SELECT COUNT(*) AS c FROM team_enquiry_members WHERE team_id=%s',
        (team_id,)
    )
    if cur.fetchone()['c'] <= 1:
        db.close()
        return jsonify({'error': 'Cannot remove the last member of a team'}), 400

    cur.execute('DELETE FROM team_enquiry_members WHERE id=%s', (member_id,))
    db.commit()
    db.close()
    return jsonify({'message': 'Member removed'}), 200


# ── CSV Import ────────────────────────────────────────────────────────────────

@team_enquiries_bp.route('/import-csv', methods=['POST'])
@jwt_required()
def import_csv():
    """
    Accepts a CSV exported from Google Forms or a plain CSV.

    Google Form column names supported:
      'Team Name', 'Team member Name', 'Phone number', 'Email id', 'Service', 'Source'

    Plain column names also supported:
      'team_name', 'name', 'phone', 'email', 'service', 'source'

    Groups rows by Team Name → one team_enquiry + N team_enquiry_members per group.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    f       = request.files['file']
    content = f.read().decode('utf-8-sig')   # strip BOM if present
    reader  = csv.DictReader(io.StringIO(content))

    # Normalise all column names: strip whitespace, lowercase, replace spaces with _
    # e.g. "Team member Name" → "team_member_name"
    #      "Phone number"     → "phone_number"
    #      "Email id"         → "email_id"
    #      "Team Name"        → "team_name"
    rows = []
    for row in reader:
        normalised = {k.strip().lower().replace(' ', '_'): v.strip() for k, v in row.items()}
        rows.append(normalised)

    if not rows:
        return jsonify({'error': 'CSV is empty'}), 400

    # Helper: try multiple key aliases, return first non-empty value found
    def pick(row, *keys):
        for k in keys:
            v = row.get(k, '').strip()
            if v:
                return v
        return ''

    # Group rows by team_name
    groups = {}
    for row in rows:
        # "Team Name" → normalises to "team_name"
        team_name = pick(row, 'team_name')
        if not team_name:
            team_name = 'Unknown Team'

        if team_name not in groups:
            groups[team_name] = {
                # service and source are the same for all members — take from first row
                'service': pick(row, 'service'),
                'source':  pick(row, 'source') or 'CSV Import',
                'members': []
            }

        groups[team_name]['members'].append({
            # "Team member Name" → "team_member_name"
            'name':  pick(row, 'team_member_name', 'name', 'member_name', 'full_name'),
            # "Phone number" → "phone_number"
            'phone': pick(row, 'phone_number', 'phone', 'mobile', 'contact'),
            # "Email id" → "email_id"
            'email': pick(row, 'email_id', 'email', 'email_address'),
        })

    db  = get_db()
    cur = get_cursor(db)
    created = []

    for team_name, info in groups.items():
        service = info['service'] or 'General'
        source  = info['source']  or 'CSV Import'

        cur.execute('''
            INSERT INTO team_enquiries (team_name, service, source, status)
            VALUES (%s, %s, %s, 'New')
            RETURNING id
        ''', (team_name, service, source))
        team_id = cur.fetchone()['id']

        member_count = 0
        for m in info['members']:
            if not m['name']:
                continue
            cur.execute('''
                INSERT INTO team_enquiry_members (team_id, name, phone, email)
                VALUES (%s, %s, %s, %s)
            ''', (team_id, m['name'], m['phone'] or None, m['email'] or None))
            member_count += 1

        created.append({'team_id': team_id, 'team_name': team_name, 'members': member_count})

    db.commit()
    db.close()
    return jsonify({
        'message': f'{len(created)} team(s) imported successfully',
        'teams': created
    }), 201


# ── Converted teams (for session booking dropdown) ────────────────────────────

@team_enquiries_bp.route('/converted', methods=['GET'])
@jwt_required()
def converted_teams():
    db  = get_db()
    cur = get_cursor(db)
    cur.execute('''
        SELECT te.id, te.team_name, te.service,
               COUNT(tem.id) AS member_count
        FROM team_enquiries te
        LEFT JOIN team_enquiry_members tem ON tem.team_id = te.id
        WHERE te.status = 'Converted'
        GROUP BY te.id
        ORDER BY te.team_name
    ''')
    teams = cur.fetchall()

    result = []
    for t in teams:
        cur.execute(
            'SELECT * FROM team_enquiry_members WHERE team_id = %s ORDER BY id',
            (t['id'],)
        )
        members = cur.fetchall()
        row = dict(t)
        row['members'] = [dict(m) for m in members]
        result.append(row)

    db.close()
    return jsonify(result), 200