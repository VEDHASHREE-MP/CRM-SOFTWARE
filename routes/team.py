from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash
import psycopg2.extras
from database import get_db

team_bp = Blueprint('team', __name__)


def get_cursor(db):
    return db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


# ── Users (members) ───────────────────────────────────────────────────────────

@team_bp.route('/members', methods=['GET'])
@jwt_required()
def get_active_members():
    db  = get_db()
    cur = get_cursor(db)
    cur.execute('SELECT id, name, email, role FROM users WHERE is_active = 1 ORDER BY name')
    members = cur.fetchall()
    db.close()
    return jsonify([dict(m) for m in members]), 200


@team_bp.route('/members/all', methods=['GET'])
@jwt_required()
def get_all_members():
    db  = get_db()
    cur = get_cursor(db)
    cur.execute('''
        SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
               c.name AS created_by_name
        FROM users u
        LEFT JOIN users c ON u.created_by = c.id
        ORDER BY u.created_at DESC
    ''')
    members = cur.fetchall()
    db.close()
    return jsonify([dict(m) for m in members]), 200


@team_bp.route('/members/add', methods=['POST'])
@jwt_required()
def add_member():
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    requester = cur.fetchone()

    if not requester or requester['role'] != 'admin':
        db.close()
        return jsonify({'error': 'Admin access required'}), 403

    data     = request.get_json()
    name     = data.get('name',     '').strip()
    email    = data.get('email',    '').strip().lower()
    password = data.get('password', '').strip()
    role     = data.get('role',     'staff')

    if not all([name, email, password]):
        db.close()
        return jsonify({'error': 'Name, email, and password are required'}), 400

    if role not in ['admin', 'staff']:
        db.close()
        return jsonify({'error': 'Role must be admin or staff'}), 400

    cur.execute('SELECT id FROM users WHERE email = %s', (email,))
    if cur.fetchone():
        db.close()
        return jsonify({'error': 'Email already registered'}), 409

    cur.execute('''
        INSERT INTO users (name, email, password_hash, role, created_by)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
    ''', (name, email, generate_password_hash(password), role, user_id))
    new_id = cur.fetchone()['id']
    db.commit()

    cur.execute(
        'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = %s',
        (new_id,)
    )
    new_member = cur.fetchone()
    db.close()

    return jsonify({'message': 'Team member added', 'member': dict(new_member)}), 201


@team_bp.route('/members/<int:member_id>/toggle', methods=['PATCH'])
@jwt_required()
def toggle_member(member_id):
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    requester = cur.fetchone()

    if not requester or requester['role'] != 'admin':
        db.close()
        return jsonify({'error': 'Admin access required'}), 403

    if int(user_id) == member_id:
        db.close()
        return jsonify({'error': 'Cannot deactivate yourself'}), 400

    cur.execute('SELECT * FROM users WHERE id = %s', (member_id,))
    member = cur.fetchone()
    if not member:
        db.close()
        return jsonify({'error': 'Member not found'}), 404

    new_status = 0 if member['is_active'] else 1
    cur.execute('UPDATE users SET is_active = %s WHERE id = %s', (new_status, member_id))
    db.commit()
    db.close()

    return jsonify({
        'message':   f'Member {"activated" if new_status else "deactivated"}',
        'is_active': bool(new_status)
    }), 200


@team_bp.route('/members/<int:member_id>', methods=['PUT'])
@jwt_required()
def update_member(member_id):
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    requester = cur.fetchone()

    if not requester or requester['role'] != 'admin':
        db.close()
        return jsonify({'error': 'Admin access required'}), 403

    data         = request.get_json()
    name         = data.get('name',     '').strip()
    role         = data.get('role',     'staff')
    new_password = data.get('password', '').strip()

    if not name:
        db.close()
        return jsonify({'error': 'Name is required'}), 400

    if new_password:
        cur.execute(
            'UPDATE users SET name = %s, role = %s, password_hash = %s WHERE id = %s',
            (name, role, generate_password_hash(new_password), member_id)
        )
    else:
        cur.execute(
            'UPDATE users SET name = %s, role = %s WHERE id = %s',
            (name, role, member_id)
        )

    db.commit()

    cur.execute('SELECT id, name, email, role, is_active FROM users WHERE id = %s', (member_id,))
    updated = cur.fetchone()
    db.close()

    return jsonify({'message': 'Member updated', 'member': dict(updated)}), 200


# ── Teams (groups) ────────────────────────────────────────────────────────────

@team_bp.route('/', methods=['GET'])
@jwt_required()
def get_teams():
    db  = get_db()
    cur = get_cursor(db)
    cur.execute('''
        SELECT t.id, t.name, t.created_at, u.name AS created_by_name
        FROM teams t
        LEFT JOIN users u ON t.created_by = u.id
        ORDER BY t.created_at DESC
    ''')
    teams = cur.fetchall()

    result = []
    for team in teams:
        cur.execute('''
            SELECT u.id, u.name, u.email, u.role, u.is_active
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = %s
            ORDER BY u.name
        ''', (team['id'],))
        members = cur.fetchall()
        result.append({**dict(team), 'members': [dict(m) for m in members]})

    db.close()
    return jsonify(result), 200


@team_bp.route('/create', methods=['POST'])
@jwt_required()
def create_team():
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    requester = cur.fetchone()

    if not requester or requester['role'] != 'admin':
        db.close()
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    name = data.get('name', '').strip()

    if not name:
        db.close()
        return jsonify({'error': 'Team name is required'}), 400

    cur.execute('SELECT id FROM teams WHERE name = %s', (name,))
    if cur.fetchone():
        db.close()
        return jsonify({'error': 'A team with this name already exists'}), 409

    cur.execute(
        'INSERT INTO teams (name, created_by) VALUES (%s, %s) RETURNING id',
        (name, user_id)
    )
    new_id = cur.fetchone()['id']
    db.commit()

    cur.execute('''
        SELECT t.id, t.name, t.created_at, u.name AS created_by_name
        FROM teams t LEFT JOIN users u ON t.created_by = u.id
        WHERE t.id = %s
    ''', (new_id,))
    team = cur.fetchone()
    db.close()

    return jsonify({'message': 'Team created', 'team': {**dict(team), 'members': []}}), 201


@team_bp.route('/<int:team_id>', methods=['PUT'])
@jwt_required()
def update_team(team_id):
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    requester = cur.fetchone()

    if not requester or requester['role'] != 'admin':
        db.close()
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    name = data.get('name', '').strip()

    if not name:
        db.close()
        return jsonify({'error': 'Team name is required'}), 400

    cur.execute('SELECT id FROM teams WHERE name = %s AND id != %s', (name, team_id))
    if cur.fetchone():
        db.close()
        return jsonify({'error': 'A team with this name already exists'}), 409

    cur.execute('UPDATE teams SET name = %s WHERE id = %s', (name, team_id))
    db.commit()
    db.close()
    return jsonify({'message': 'Team renamed'}), 200


@team_bp.route('/<int:team_id>', methods=['DELETE'])
@jwt_required()
def delete_team(team_id):
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    requester = cur.fetchone()

    if not requester or requester['role'] != 'admin':
        db.close()
        return jsonify({'error': 'Admin access required'}), 403

    cur.execute('DELETE FROM teams WHERE id = %s', (team_id,))
    db.commit()
    db.close()
    return jsonify({'message': 'Team deleted'}), 200


@team_bp.route('/<int:team_id>/members', methods=['POST'])
@jwt_required()
def add_member_to_team(team_id):
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    requester = cur.fetchone()

    if not requester or requester['role'] != 'admin':
        db.close()
        return jsonify({'error': 'Admin access required'}), 403

    data           = request.get_json()
    member_user_id = data.get('user_id')

    if not member_user_id:
        db.close()
        return jsonify({'error': 'user_id is required'}), 400

    cur.execute('SELECT id FROM teams WHERE id = %s', (team_id,))
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Team not found'}), 404

    cur.execute('SELECT id FROM users WHERE id = %s', (member_user_id,))
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'User not found'}), 404

    cur.execute(
        'SELECT team_id FROM team_members WHERE team_id = %s AND user_id = %s',
        (team_id, member_user_id)
    )
    if cur.fetchone():
        db.close()
        return jsonify({'error': 'User is already in this team'}), 409

    cur.execute(
        'INSERT INTO team_members (team_id, user_id) VALUES (%s, %s)',
        (team_id, member_user_id)
    )
    db.commit()
    db.close()
    return jsonify({'message': 'Member added to team'}), 201


@team_bp.route('/<int:team_id>/members/<int:member_user_id>', methods=['DELETE'])
@jwt_required()
def remove_member_from_team(team_id, member_user_id):
    user_id = get_jwt_identity()
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    requester = cur.fetchone()

    if not requester or requester['role'] != 'admin':
        db.close()
        return jsonify({'error': 'Admin access required'}), 403

    cur.execute(
        'DELETE FROM team_members WHERE team_id = %s AND user_id = %s',
        (team_id, member_user_id)
    )
    db.commit()
    db.close()
    return jsonify({'message': 'Member removed from team'}), 200