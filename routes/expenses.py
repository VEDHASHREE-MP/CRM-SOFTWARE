from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import psycopg2.extras
from database import get_db

expenses_bp = Blueprint('expenses', __name__)


def get_cursor(db):
    return db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def is_admin(user_id):
    db = get_db()
    cur = get_cursor(db)
    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()
    db.close()
    return user and user['role'] == 'admin'


# ── EXPENSES ──────────────────────────────────────────────────────────────────

@expenses_bp.route('/', methods=['GET'])
@jwt_required()
def list_expenses():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db = get_db()
    cur = get_cursor(db)
    date_from = request.args.get('date_from', '')
    date_to   = request.args.get('date_to', '')
    category  = request.args.get('category', '')

    query  = '''
        SELECT e.*, u.name AS created_by_name
        FROM expenses e
        LEFT JOIN users u ON e.created_by = u.id
        WHERE 1=1
    '''
    params = []
    if date_from:
        query += ' AND e.expense_date >= %s'
        params.append(date_from)
    if date_to:
        query += ' AND e.expense_date <= %s'
        params.append(date_to)
    if category:
        query += ' AND e.category = %s'
        params.append(category)

    query += ' ORDER BY e.expense_date DESC, e.created_at DESC'

    cur.execute(query, params)
    rows = cur.fetchall()
    db.close()
    return jsonify([dict(r) for r in rows]), 200


@expenses_bp.route('/', methods=['POST'])
@jwt_required()
def create_expense():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    title        = data.get('title', '').strip()
    category     = data.get('category', '').strip()
    amount       = data.get('amount')
    expense_date = data.get('expense_date', '')
    notes        = data.get('notes', '').strip()

    if not title or not category or amount is None or not expense_date:
        return jsonify({'error': 'title, category, amount, and expense_date are required'}), 400

    try:
        amount = float(amount)
        if amount <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({'error': 'amount must be a positive number'}), 400

    db = get_db()
    cur = get_cursor(db)
    cur.execute('''
        INSERT INTO expenses (title, category, amount, expense_date, notes, created_by)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
    ''', (title, category, amount, expense_date, notes, user_id))
    new_id = cur.fetchone()['id']
    db.commit()

    cur.execute('''
        SELECT e.*, u.name AS created_by_name
        FROM expenses e LEFT JOIN users u ON e.created_by = u.id
        WHERE e.id = %s
    ''', (new_id,))
    row = cur.fetchone()
    db.close()
    return jsonify(dict(row)), 201


@expenses_bp.route('/<int:eid>', methods=['PUT'])
@jwt_required()
def update_expense(eid):
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db = get_db()
    cur = get_cursor(db)
    cur.execute('SELECT id FROM expenses WHERE id = %s', (eid,))
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Expense not found'}), 404

    data = request.get_json()
    title        = data.get('title', '').strip()
    category     = data.get('category', '').strip()
    amount       = data.get('amount')
    expense_date = data.get('expense_date', '')
    notes        = data.get('notes', '').strip()

    if not title or not category or amount is None or not expense_date:
        return jsonify({'error': 'title, category, amount, and expense_date are required'}), 400

    try:
        amount = float(amount)
        if amount <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({'error': 'amount must be a positive number'}), 400

    cur.execute('''
        UPDATE expenses
        SET title=%s, category=%s, amount=%s, expense_date=%s, notes=%s,
            updated_at=to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')
        WHERE id=%s
    ''', (title, category, amount, expense_date, notes, eid))
    db.commit()

    cur.execute('''
        SELECT e.*, u.name AS created_by_name
        FROM expenses e LEFT JOIN users u ON e.created_by = u.id
        WHERE e.id = %s
    ''', (eid,))
    row = cur.fetchone()
    db.close()
    return jsonify(dict(row)), 200


@expenses_bp.route('/<int:eid>', methods=['DELETE'])
@jwt_required()
def delete_expense(eid):
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db = get_db()
    cur = get_cursor(db)
    cur.execute('SELECT id FROM expenses WHERE id = %s', (eid,))
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Expense not found'}), 404

    cur.execute('DELETE FROM expenses WHERE id = %s', (eid,))
    db.commit()
    db.close()
    return jsonify({'message': 'Expense deleted'}), 200


@expenses_bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    defaults = [
        'Office & Rent', 'Utilities', 'Staff Salaries', 'Equipment & Tools',
        'Marketing & Ads', 'Travel', 'Software & Subscriptions',
        'Maintenance', 'Miscellaneous'
    ]
    db = get_db()
    cur = get_cursor(db)
    cur.execute('SELECT DISTINCT category FROM expenses ORDER BY category')
    rows = cur.fetchall()
    db.close()
    db_cats = [r['category'] for r in rows]
    merged  = list(dict.fromkeys(defaults + db_cats))
    return jsonify(merged), 200


# ── RETURNS ───────────────────────────────────────────────────────────────────

@expenses_bp.route('/returns/', methods=['GET'])
@jwt_required()
def list_returns():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db = get_db()
    cur = get_cursor(db)
    date_from = request.args.get('date_from', '')
    date_to   = request.args.get('date_to', '')

    query  = '''
        SELECT r.*, u.name AS created_by_name
        FROM returns r
        LEFT JOIN users u ON r.created_by = u.id
        WHERE 1=1
    '''
    params = []
    if date_from:
        query += ' AND r.return_date >= %s'
        params.append(date_from)
    if date_to:
        query += ' AND r.return_date <= %s'
        params.append(date_to)

    query += ' ORDER BY r.return_date DESC, r.created_at DESC'

    cur.execute(query, params)
    rows = cur.fetchall()
    db.close()
    return jsonify([dict(r) for r in rows]), 200


@expenses_bp.route('/returns/', methods=['POST'])
@jwt_required()
def create_return():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    title       = data.get('title', '').strip()
    amount      = data.get('amount')
    return_date = data.get('return_date', '')
    notes       = data.get('notes', '').strip()

    if not title or amount is None or not return_date:
        return jsonify({'error': 'title, amount, and return_date are required'}), 400

    try:
        amount = float(amount)
        if amount <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({'error': 'amount must be a positive number'}), 400

    db = get_db()
    cur = get_cursor(db)
    cur.execute('''
        INSERT INTO returns (title, amount, return_date, notes, created_by)
        VALUES (%s, %s, %s, %s, %s) RETURNING id
    ''', (title, amount, return_date, notes, user_id))
    new_id = cur.fetchone()['id']
    db.commit()

    cur.execute('''
        SELECT r.*, u.name AS created_by_name
        FROM returns r LEFT JOIN users u ON r.created_by = u.id
        WHERE r.id = %s
    ''', (new_id,))
    row = cur.fetchone()
    db.close()
    return jsonify(dict(row)), 201


@expenses_bp.route('/returns/<int:rid>', methods=['PUT'])
@jwt_required()
def update_return(rid):
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db = get_db()
    cur = get_cursor(db)
    cur.execute('SELECT id FROM returns WHERE id = %s', (rid,))
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Return not found'}), 404

    data = request.get_json()
    title       = data.get('title', '').strip()
    amount      = data.get('amount')
    return_date = data.get('return_date', '')
    notes       = data.get('notes', '').strip()

    if not title or amount is None or not return_date:
        return jsonify({'error': 'title, amount, and return_date are required'}), 400

    try:
        amount = float(amount)
        if amount <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({'error': 'amount must be a positive number'}), 400

    cur.execute('''
        UPDATE returns
        SET title=%s, amount=%s, return_date=%s, notes=%s,
            updated_at=to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')
        WHERE id=%s
    ''', (title, amount, return_date, notes, rid))
    db.commit()

    cur.execute('''
        SELECT r.*, u.name AS created_by_name
        FROM returns r LEFT JOIN users u ON r.created_by = u.id
        WHERE r.id = %s
    ''', (rid,))
    row = cur.fetchone()
    db.close()
    return jsonify(dict(row)), 200


@expenses_bp.route('/returns/<int:rid>', methods=['DELETE'])
@jwt_required()
def delete_return(rid):
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db = get_db()
    cur = get_cursor(db)
    cur.execute('SELECT id FROM returns WHERE id = %s', (rid,))
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Return not found'}), 404

    cur.execute('DELETE FROM returns WHERE id = %s', (rid,))
    db.commit()
    db.close()
    return jsonify({'message': 'Return deleted'}), 200


# ── CHARTS & SUMMARY ──────────────────────────────────────────────────────────

@expenses_bp.route('/summary', methods=['GET'])
@jwt_required()
def summary():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db = get_db()
    cur = get_cursor(db)
    date_from = request.args.get('date_from', '')
    date_to   = request.args.get('date_to', '')

    def date_filter(col):
        clauses = []
        if date_from: clauses.append(f"AND {col} >= '{date_from}'")
        if date_to:   clauses.append(f"AND {col} <= '{date_to}'")
        return ' '.join(clauses)

    cur.execute(f"SELECT COALESCE(SUM(amount),0) AS t FROM expenses WHERE 1=1 {date_filter('expense_date')}")
    exp_total = cur.fetchone()['t']

    cur.execute(f"SELECT COALESCE(SUM(amount),0) AS t FROM returns WHERE 1=1 {date_filter('return_date')}")
    ret_total = cur.fetchone()['t']

    cur.execute(f"SELECT COUNT(*) AS c FROM expenses WHERE 1=1 {date_filter('expense_date')}")
    exp_count = cur.fetchone()['c']

    cur.execute(f"SELECT COUNT(*) AS c FROM returns WHERE 1=1 {date_filter('return_date')}")
    ret_count = cur.fetchone()['c']

    cur.execute(f'''
        SELECT category, COALESCE(SUM(amount),0) AS total
        FROM expenses WHERE 1=1 {date_filter('expense_date')}
        GROUP BY category ORDER BY total DESC
    ''')
    cat_rows = cur.fetchall()

    # Monthly trend — PostgreSQL uses to_char instead of strftime
    cur.execute(f'''
        SELECT to_char(expense_date::date, 'YYYY-MM') AS month,
               COALESCE(SUM(amount),0) AS expenses
        FROM expenses WHERE 1=1 {date_filter('expense_date')}
        GROUP BY month ORDER BY month ASC
    ''')
    monthly_exp = cur.fetchall()

    cur.execute(f'''
        SELECT to_char(return_date::date, 'YYYY-MM') AS month,
               COALESCE(SUM(amount),0) AS returns
        FROM returns WHERE 1=1 {date_filter('return_date')}
        GROUP BY month ORDER BY month ASC
    ''')
    monthly_ret = cur.fetchall()

    months = {}
    for r in monthly_exp:
        months[r['month']] = {'month': r['month'], 'expenses': r['expenses'], 'returns': 0}
    for r in monthly_ret:
        if r['month'] in months:
            months[r['month']]['returns'] = r['returns']
        else:
            months[r['month']] = {'month': r['month'], 'expenses': 0, 'returns': r['returns']}

    monthly_trend = sorted(months.values(), key=lambda x: x['month'])

    db.close()
    return jsonify({
        'total_expenses':     round(float(exp_total), 2),
        'total_returns':      round(float(ret_total), 2),
        'net':                round(float(ret_total) - float(exp_total), 2),
        'expense_count':      exp_count,
        'return_count':       ret_count,
        'category_breakdown': [dict(r) for r in cat_rows],
        'monthly_trend':      monthly_trend,
    }), 200