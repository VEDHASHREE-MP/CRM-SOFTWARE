from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import psycopg2.extras
from database import get_db

customers_bp = Blueprint('customers', __name__)

LOYALTY_TIERS = ['New', 'Regular', 'Loyal', 'VIP']


def get_cursor(db):
    return db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def is_admin(user_id):
    db = get_db()
    cur = get_cursor(db)
    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()
    db.close()
    return user and user['role'] == 'admin'


# ── Enquiry Customers ─────────────────────────────────────────────────────────

@customers_bp.route('/enquiry', methods=['GET'])
@jwt_required()
def get_enquiry_customers():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    search      = request.args.get('search', '').strip()
    tier_filter = request.args.get('tier', '').strip()

    db = get_db()
    cur = get_cursor(db)
    query = '''
        SELECT
            e.id, e.name, e.phone, e.service, e.source, e.loyalty_tier,
            e.created_at AS enquiry_date,
            COUNT(DISTINCT s.id)                                              AS total_sessions,
            SUM(CASE WHEN s.status = 'Completed' THEN 1 ELSE 0 END)          AS completed_sessions,
            SUM(CASE WHEN s.status = 'Scheduled' THEN 1 ELSE 0 END)          AS upcoming_sessions,
            MAX(s.session_date)                                               AS last_session_date,
            COUNT(DISTINCT i.id)                                              AS total_invoices,
            COALESCE(SUM(DISTINCT CASE WHEN i.id IS NOT NULL THEN i.total_amount ELSE 0 END), 0) AS total_invoiced,
            COALESCE(SUM(DISTINCT CASE WHEN i.id IS NOT NULL THEN i.paid_amount  ELSE 0 END), 0) AS total_paid,
            COALESCE(SUM(DISTINCT CASE WHEN i.id IS NOT NULL THEN i.due_amount   ELSE 0 END), 0) AS total_due
        FROM enquiries e
        LEFT JOIN sessions s ON s.enquiry_id = e.id
        LEFT JOIN invoices i ON i.enquiry_id = e.id AND i.status != 'Cancelled'
        WHERE e.status = 'Converted'
    '''
    params = []

    if search:
        query += ' AND (e.name ILIKE %s OR e.phone ILIKE %s OR e.service ILIKE %s)'
        params.extend([f'%{search}%', f'%{search}%', f'%{search}%'])

    if tier_filter:
        query += ' AND e.loyalty_tier = %s'
        params.append(tier_filter)

    query += ' GROUP BY e.id ORDER BY e.name ASC'

    cur.execute(query, params)
    rows = cur.fetchall()
    db.close()
    return jsonify([dict(r) for r in rows]), 200


@customers_bp.route('/enquiry/<int:enquiry_id>', methods=['PUT'])
@jwt_required()
def update_enquiry_customer(enquiry_id):
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    name         = data.get('name', '').strip()
    phone        = data.get('phone', '').strip()
    loyalty_tier = data.get('loyalty_tier', 'New')

    if not name or not phone:
        return jsonify({'error': 'Name and phone are required'}), 400

    if loyalty_tier not in LOYALTY_TIERS:
        return jsonify({'error': f'loyalty_tier must be one of {LOYALTY_TIERS}'}), 400

    db = get_db()
    cur = get_cursor(db)
    cur.execute(
        "SELECT id FROM enquiries WHERE id = %s AND status = 'Converted'", (enquiry_id,)
    )
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Customer not found'}), 404

    cur.execute(
        """UPDATE enquiries SET name=%s, phone=%s, loyalty_tier=%s,
           updated_at=to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS') WHERE id=%s""",
        (name, phone, loyalty_tier, enquiry_id)
    )
    db.commit()
    db.close()
    return jsonify({'message': 'Customer updated'}), 200


# ── Invoice Customers ─────────────────────────────────────────────────────────

@customers_bp.route('/invoice', methods=['GET'])
@jwt_required()
def get_invoice_customers():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    search      = request.args.get('search', '').strip()
    tier_filter = request.args.get('tier', '').strip()

    db = get_db()
    cur = get_cursor(db)

    # Auto-sync orphan invoices
    cur.execute('''
        SELECT DISTINCT customer_name, phone
        FROM invoices
        WHERE enquiry_id IS NULL
          AND phone NOT IN (SELECT phone FROM invoice_customers)
    ''')
    orphan_invoices = cur.fetchall()

    for row in orphan_invoices:
        try:
            cur.execute(
                'INSERT INTO invoice_customers (name, phone) VALUES (%s, %s) ON CONFLICT (phone) DO NOTHING',
                (row['customer_name'], row['phone'])
            )
        except Exception:
            pass
    if orphan_invoices:
        db.commit()

    query = '''
        SELECT
            ic.id, ic.name, ic.phone, ic.loyalty_tier, ic.created_at,
            COUNT(DISTINCT i.id)                AS total_invoices,
            COALESCE(SUM(i.total_amount), 0)    AS total_invoiced,
            COALESCE(SUM(i.paid_amount),  0)    AS total_paid,
            COALESCE(SUM(i.due_amount),   0)    AS total_due,
            STRING_AGG(DISTINCT ii.description, ', ') AS descriptions
        FROM invoice_customers ic
        LEFT JOIN invoices i  ON i.phone = ic.phone
                              AND i.enquiry_id IS NULL
                              AND i.status != 'Cancelled'
        LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
        WHERE 1=1
    '''
    params = []

    if search:
        query += ' AND (ic.name ILIKE %s OR ic.phone ILIKE %s)'
        params.extend([f'%{search}%', f'%{search}%'])

    if tier_filter:
        query += ' AND ic.loyalty_tier = %s'
        params.append(tier_filter)

    query += ' GROUP BY ic.id ORDER BY ic.name ASC'

    cur.execute(query, params)
    rows = cur.fetchall()
    db.close()
    return jsonify([dict(r) for r in rows]), 200


@customers_bp.route('/invoice/<int:customer_id>', methods=['PUT'])
@jwt_required()
def update_invoice_customer(customer_id):
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    name         = data.get('name', '').strip()
    phone        = data.get('phone', '').strip()
    loyalty_tier = data.get('loyalty_tier', 'New')

    if not name or not phone:
        return jsonify({'error': 'Name and phone are required'}), 400

    if loyalty_tier not in LOYALTY_TIERS:
        return jsonify({'error': f'loyalty_tier must be one of {LOYALTY_TIERS}'}), 400

    db = get_db()
    cur = get_cursor(db)
    cur.execute('SELECT id FROM invoice_customers WHERE id = %s', (customer_id,))
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Customer not found'}), 404

    cur.execute(
        """UPDATE invoice_customers SET name=%s, phone=%s, loyalty_tier=%s,
           updated_at=to_char(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS') WHERE id=%s""",
        (name, phone, loyalty_tier, customer_id)
    )
    db.commit()
    db.close()
    return jsonify({'message': 'Customer updated'}), 200


# ── Stats Summary ─────────────────────────────────────────────────────────────

@customers_bp.route('/stats/summary', methods=['GET'])
@jwt_required()
def stats_summary():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db = get_db()
    cur = get_cursor(db)
    from datetime import datetime
    month_start = datetime.now().strftime('%Y-%m-01')

    cur.execute("SELECT COUNT(*) AS c FROM enquiries WHERE status='Converted'")
    total_enquiry = cur.fetchone()['c']

    cur.execute("SELECT COUNT(*) AS c FROM invoice_customers")
    total_invoice = cur.fetchone()['c']

    cur.execute(
        "SELECT COUNT(*) AS c FROM enquiries WHERE status='Converted' AND updated_at::date >= %s",
        (month_start,)
    )
    new_this_month = cur.fetchone()['c']

    cur.execute("SELECT COALESCE(SUM(amount), 0) AS s FROM payments")
    total_revenue = cur.fetchone()['s']

    cur.execute("SELECT COALESCE(SUM(due_amount), 0) AS s FROM invoices WHERE status NOT IN ('Paid','Cancelled')")
    total_due = cur.fetchone()['s']

    cur.execute('''
        SELECT loyalty_tier, COUNT(*) AS c
        FROM enquiries WHERE status = 'Converted'
        GROUP BY loyalty_tier
    ''')
    tiers = cur.fetchall()
    tier_map = {r['loyalty_tier']: r['c'] for r in tiers}

    db.close()
    return jsonify({
        'total_enquiry_customers': total_enquiry,
        'total_invoice_customers': total_invoice,
        'new_this_month':          new_this_month,
        'total_revenue':           round(float(total_revenue), 2),
        'total_due':               round(float(total_due), 2),
        'tiers': {
            'VIP':     tier_map.get('VIP',     0),
            'Loyal':   tier_map.get('Loyal',   0),
            'Regular': tier_map.get('Regular', 0),
            'New':     tier_map.get('New',      0),
        }
    }), 200


# ── Services list for filter ───────────────────────────────────────────────────

@customers_bp.route('/services-list', methods=['GET'])
@jwt_required()
def services_list():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db = get_db()
    cur = get_cursor(db)
    cur.execute("SELECT DISTINCT service FROM enquiries WHERE status='Converted' ORDER BY service")
    rows = cur.fetchall()
    db.close()
    return jsonify([r['service'] for r in rows]), 200