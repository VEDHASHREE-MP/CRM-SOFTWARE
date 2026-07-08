from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from whatsapp import message_customer_invoice_created, message_customer_payment_confirmed, notify_admin_payment_received
import psycopg2.extras
from database import get_db
from datetime import datetime

billing_bp = Blueprint('billing', __name__)


def get_cursor(db):
    return db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def is_admin(user_id):
    db  = get_db()
    cur = get_cursor(db)
    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()
    db.close()
    return user and user['role'] == 'admin'


def generate_invoice_number(db):
    """Generate sequential invoice number like VT-2026-0001 using a DB sequence."""
    year = datetime.now().year
    seq_name = f'invoice_seq_{year}'
    cur = get_cursor(db)
    # Create the sequence for this year if it doesn't exist yet
    cur.execute(f"CREATE SEQUENCE IF NOT EXISTS {seq_name} START 1")
    cur.execute(f"SELECT nextval('{seq_name}') AS n")
    seq = cur.fetchone()['n']
    return f'VT-{year}-{seq:04d}'


def recalculate_totals(db, invoice_id, force_status=None):
    """Recalculate subtotal → gst → total → due from items + payments.

    force_status: if provided, use this status instead of auto-calculating.
                  Pass when the user has explicitly chosen a status on create/edit.
    """
    cur = get_cursor(db)

    cur.execute('SELECT * FROM invoices WHERE id = %s', (invoice_id,))
    invoice = cur.fetchone()
    if not invoice:
        return

    cur.execute(
        'SELECT COALESCE(SUM(amount), 0) AS s FROM invoice_items WHERE invoice_id = %s',
        (invoice_id,)
    )
    subtotal = round(float(cur.fetchone()['s']), 2)

    discount   = round(float(invoice['discount']), 2)
    gst_rate   = round(float(invoice['gst_rate']), 2)
    after_disc = round(subtotal - discount, 2)
    gst_amount = round(after_disc * gst_rate / 100, 2)
    total      = round(after_disc + gst_amount, 2)

    cur.execute(
        'SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE invoice_id = %s',
        (invoice_id,)
    )
    paid = round(float(cur.fetchone()['s']), 2)
    due  = round(total - paid, 2)

    if force_status:
        # User explicitly set a status — respect it
        current_status = force_status
    else:
        # Auto-calculate based on payment amounts — always runs (even for Draft/Sent)
        current_status = invoice['status']
        if due <= 0:
            current_status = 'Paid'
        elif paid > 0:
            current_status = 'Partially Paid'
        elif current_status in ('Paid', 'Partially Paid'):
            # Payment was removed — fall back to Sent
            current_status = 'Sent'

    cur.execute('''
        UPDATE invoices
        SET subtotal=%s, gst_amount=%s, total_amount=%s,
            paid_amount=%s, due_amount=%s, status=%s, updated_at=NOW()
        WHERE id=%s
    ''', (subtotal, gst_amount, total, paid, due, current_status, invoice_id))


def adjust_stock_for_items(cur, items, direction=1):
    """
    direction = +1 to ADD stock back (invoice deleted / items removed)
    direction = -1 to DEDUCT stock (invoice created / items added)

    Matches invoice item description against product name (case-insensitive).
    Only adjusts if a matching active product is found — free-text items
    that don't match any product are silently skipped (no crash).
    """
    for item in items:
        desc     = (item.get('description') or '').strip()
        quantity = float(item.get('quantity', 1))
        if not desc or quantity <= 0:
            continue
        cur.execute(
            "SELECT id, current_stock FROM products WHERE name ILIKE %s AND is_active = TRUE LIMIT 1",
            (desc,)
        )
        product = cur.fetchone()
        if not product:
            continue  # Free-text item with no matching product — skip

        new_stock = float(product['current_stock']) + (direction * quantity)
        # Clamp to 0 — never go negative
        new_stock = max(0, new_stock)
        cur.execute(
            "UPDATE products SET current_stock = %s, updated_at = NOW() WHERE id = %s",
            (new_stock, product['id'])
        )


def invoice_to_dict(row, items=None, payments=None):
    d = dict(row)
    if items    is not None: d['items']    = [dict(i) for i in items]
    if payments is not None: d['payments'] = [dict(p) for p in payments]
    return d


# ── Invoice List & Create ──────────────────────────────────────────────────────

@billing_bp.route('/', methods=['GET'])
@jwt_required()
def get_invoices():
    db  = get_db()
    cur = get_cursor(db)

    status_filter = request.args.get('status',    '')
    search        = request.args.get('search',    '')
    date_from     = request.args.get('date_from', '')
    date_to       = request.args.get('date_to',   '')

    query  = '''
        SELECT i.*, u.name AS created_by_name
        FROM invoices i
        LEFT JOIN users u ON i.created_by = u.id
        WHERE 1=1
    '''
    params = []

    if status_filter:
        query += ' AND i.status = %s'
        params.append(status_filter)

    if search:
        query += ' AND (i.customer_name ILIKE %s OR i.phone ILIKE %s OR i.invoice_number ILIKE %s)'
        params.extend([f'%{search}%', f'%{search}%', f'%{search}%'])

    if date_from:
        query += ' AND i.created_at::date >= %s'
        params.append(date_from)

    if date_to:
        query += ' AND i.created_at::date <= %s'
        params.append(date_to)

    query += ' ORDER BY i.created_at DESC'

    cur.execute(query, params)
    invoices = cur.fetchall()
    db.close()
    return jsonify([dict(inv) for inv in invoices]), 200


@billing_bp.route('/', methods=['POST'])
@jwt_required()
def create_invoice():
    user_id = get_jwt_identity()
    data    = request.get_json()

    customer_name = data.get('customer_name', '').strip()
    phone         = data.get('phone',         '').strip()
    enquiry_id    = data.get('enquiry_id')  or None
    session_id    = data.get('session_id')  or None
    gst_rate      = float(data.get('gst_rate',  0))
    discount      = float(data.get('discount',  0))
    notes         = data.get('notes', '').strip()
    items         = data.get('items', [])
    valid_statuses = ['Draft', 'Sent', 'Paid', 'Partially Paid', 'Cancelled']
    status        = data.get('status', 'Draft')
    if status not in valid_statuses:
        status = 'Draft'

    if not customer_name or not phone:
        return jsonify({'error': 'customer_name and phone are required'}), 400

    if not items:
        return jsonify({'error': 'At least one line item is required'}), 400

    db  = get_db()
    cur = get_cursor(db)

    invoice_number = generate_invoice_number(db)

    cur.execute('''
        INSERT INTO invoices
            (invoice_number, customer_name, phone, enquiry_id, session_id,
             gst_rate, discount, notes, status, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    ''', (invoice_number, customer_name, phone, enquiry_id, session_id,
          gst_rate, discount, notes or None, status, user_id))

    invoice_id = cur.fetchone()['id']

    for item in items:
        desc       = item.get('description', '').strip()
        quantity   = float(item.get('quantity',   1))
        unit_price = float(item.get('unit_price', 0))
        amount     = round(quantity * unit_price, 2)
        if desc:
            cur.execute('''
                INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount)
                VALUES (%s, %s, %s, %s, %s)
            ''', (invoice_id, desc, quantity, unit_price, amount))

    recalculate_totals(db, invoice_id, force_status=status)

    # Deduct stock for each line item that matches a product
    cur.execute('SELECT * FROM invoice_items WHERE invoice_id = %s', (invoice_id,))
    created_items = cur.fetchall()
    adjust_stock_for_items(cur, created_items, direction=-1)

    db.commit()

    cur.execute('''
        SELECT i.*, u.name AS created_by_name FROM invoices i
        LEFT JOIN users u ON i.created_by = u.id WHERE i.id = %s
    ''', (invoice_id,))
    invoice = cur.fetchone()

    cur.execute('SELECT * FROM invoice_items WHERE invoice_id = %s', (invoice_id,))
    inv_items = cur.fetchall()
    db.close()

    # WhatsApp: notify customer of new invoice
    try:
        message_customer_invoice_created(
            name=customer_name,
            phone=phone,
            invoice_number=invoice_number,
            total=float(invoice['total_amount']),
            due=float(invoice['due_amount']),
        )
    except Exception as _e:
        print(f'WhatsApp error (create_invoice): {_e}')

    return jsonify({'message': 'Invoice created', 'invoice': invoice_to_dict(invoice, items=inv_items)}), 201


# ── Single Invoice ─────────────────────────────────────────────────────────────

@billing_bp.route('/<int:invoice_id>', methods=['GET'])
@jwt_required()
def get_invoice(invoice_id):
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('''
        SELECT i.*, u.name AS created_by_name FROM invoices i
        LEFT JOIN users u ON i.created_by = u.id WHERE i.id = %s
    ''', (invoice_id,))
    invoice = cur.fetchone()
    if not invoice:
        db.close()
        return jsonify({'error': 'Invoice not found'}), 404

    cur.execute('SELECT * FROM invoice_items WHERE invoice_id = %s ORDER BY id', (invoice_id,))
    items = cur.fetchall()

    cur.execute('''
        SELECT p.*, u.name AS recorded_by_name
        FROM payments p LEFT JOIN users u ON p.created_by = u.id
        WHERE p.invoice_id = %s
        ORDER BY p.payment_date DESC, p.created_at DESC
    ''', (invoice_id,))
    payments = cur.fetchall()
    db.close()

    return jsonify(invoice_to_dict(invoice, items=items, payments=payments)), 200


@billing_bp.route('/<int:invoice_id>', methods=['PUT'])
@jwt_required()
def update_invoice(invoice_id):
    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT * FROM invoices WHERE id = %s', (invoice_id,))
    existing = cur.fetchone()
    if not existing:
        db.close()
        return jsonify({'error': 'Invoice not found'}), 404

    

    data = request.get_json()

    customer_name = data.get('customer_name', existing['customer_name']).strip()
    phone         = data.get('phone',         existing['phone']).strip()
    enquiry_id    = data.get('enquiry_id',    existing['enquiry_id']) or None
    session_id    = data.get('session_id',    existing['session_id']) or None
    gst_rate      = float(data.get('gst_rate',  existing['gst_rate']))
    discount      = float(data.get('discount',  existing['discount']))
    notes         = data.get('notes',         existing['notes'] or '')
    status        = data.get('status',        existing['status'])
    items         = data.get('items')

    valid_statuses = ['Draft', 'Sent', 'Paid', 'Partially Paid', 'Cancelled']
    if status not in valid_statuses:
        db.close()
        return jsonify({'error': f'Status must be one of {valid_statuses}'}), 400

    cur.execute('''
        UPDATE invoices
        SET customer_name=%s, phone=%s, enquiry_id=%s, session_id=%s,
            gst_rate=%s, discount=%s, notes=%s, status=%s, updated_at=NOW()
        WHERE id=%s
    ''', (customer_name, phone, enquiry_id, session_id,
          gst_rate, discount, notes or None, status, invoice_id))

    if items is not None:
        # Restore stock for old items before replacing them
        cur.execute('SELECT * FROM invoice_items WHERE invoice_id = %s', (invoice_id,))
        old_items = cur.fetchall()
        adjust_stock_for_items(cur, old_items, direction=+1)

        cur.execute('DELETE FROM invoice_items WHERE invoice_id = %s', (invoice_id,))
        for item in items:
            desc       = item.get('description', '').strip()
            quantity   = float(item.get('quantity',   1))
            unit_price = float(item.get('unit_price', 0))
            amount     = round(quantity * unit_price, 2)
            if desc:
                cur.execute('''
                    INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount)
                    VALUES (%s, %s, %s, %s, %s)
                ''', (invoice_id, desc, quantity, unit_price, amount))

        # Deduct stock for new items
        cur.execute('SELECT * FROM invoice_items WHERE invoice_id = %s', (invoice_id,))
        new_items = cur.fetchall()
        adjust_stock_for_items(cur, new_items, direction=-1)

    recalculate_totals(db, invoice_id, force_status=status)
    db.commit()

    cur.execute('''
        SELECT i.*, u.name AS created_by_name FROM invoices i
        LEFT JOIN users u ON i.created_by = u.id WHERE i.id = %s
    ''', (invoice_id,))
    invoice = cur.fetchone()

    cur.execute('SELECT * FROM invoice_items WHERE invoice_id = %s', (invoice_id,))
    inv_items = cur.fetchall()

    cur.execute('SELECT * FROM payments WHERE invoice_id = %s ORDER BY payment_date DESC', (invoice_id,))
    payments = cur.fetchall()
    db.close()

    return jsonify({'message': 'Invoice updated', 'invoice': invoice_to_dict(invoice, items=inv_items, payments=payments)}), 200


@billing_bp.route('/<int:invoice_id>', methods=['DELETE'])
@jwt_required()
def delete_invoice(invoice_id):
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT id FROM invoices WHERE id = %s', (invoice_id,))
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Invoice not found'}), 404

    # Restore stock for all items before deleting invoice
    cur.execute('SELECT * FROM invoice_items WHERE invoice_id = %s', (invoice_id,))
    items_to_restore = cur.fetchall()
    adjust_stock_for_items(cur, items_to_restore, direction=+1)

    cur.execute('DELETE FROM invoices WHERE id = %s', (invoice_id,))
    db.commit()
    db.close()
    return jsonify({'message': 'Invoice deleted'}), 200


# ── Payments ──────────────────────────────────────────────────────────────────

@billing_bp.route('/<int:invoice_id>/payments', methods=['GET'])
@jwt_required()
def get_payments(invoice_id):
    db  = get_db()
    cur = get_cursor(db)
    cur.execute('''
        SELECT p.*, u.name AS recorded_by_name
        FROM payments p LEFT JOIN users u ON p.created_by = u.id
        WHERE p.invoice_id = %s
        ORDER BY p.payment_date DESC, p.created_at DESC
    ''', (invoice_id,))
    payments = cur.fetchall()
    db.close()
    return jsonify([dict(p) for p in payments]), 200


@billing_bp.route('/<int:invoice_id>/payments', methods=['POST'])
@jwt_required()
def add_payment(invoice_id):
    user_id = get_jwt_identity()
    db = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT * FROM invoices WHERE id = %s', (invoice_id,))
    invoice = cur.fetchone()

    if not invoice:
        db.close()
        return jsonify({'error': 'Invoice not found'}), 404

    if invoice['status'] == 'Cancelled':
        db.close()
        return jsonify({'error': 'Cannot add payment to a cancelled invoice'}), 400

    if float(invoice['due_amount']) <= 0:
        db.close()
        return jsonify({'error': 'Invoice is already fully paid'}), 400

    data = request.get_json()

    amount = float(data.get('amount', 0))
    payment_mode = data.get('payment_mode', '').strip()
    payment_date = data.get(
        'payment_date',
        datetime.now().strftime('%Y-%m-%d')
    )
    notes = data.get('notes', '').strip()

    if amount <= 0:
        db.close()
        return jsonify({'error': 'Payment amount must be greater than 0'}), 400

    if amount > float(invoice['due_amount']) + 0.01:
        db.close()
        return jsonify({
            'error': f'Payment ₹{amount} exceeds due amount ₹{invoice["due_amount"]}'
        }), 400

    valid_modes = {
        'Cash',
        'UPI',
        'Card',
        'Bank Transfer',
        'Cheque'
    }

    selected_modes = [
        mode.strip()
        for mode in payment_mode.split(',')
        if mode.strip()
    ]

    if not selected_modes:
        db.close()
        return jsonify({'error': 'Select at least one payment mode'}), 400

    if not all(mode in valid_modes for mode in selected_modes):
        db.close()
        return jsonify({'error': 'Invalid payment mode selected'}), 400

    cur.execute('''
        INSERT INTO payments
        (
            invoice_id,
            amount,
            payment_mode,
            payment_date,
            notes,
            created_by
        )
        VALUES (%s, %s, %s, %s, %s, %s)
    ''', (
        invoice_id,
        amount,
        payment_mode,
        payment_date,
        notes or None,
        user_id
    ))

    recalculate_totals(db, invoice_id)
    db.commit()

    cur.execute('''
        SELECT i.*, u.name AS created_by_name
        FROM invoices i
        LEFT JOIN users u ON i.created_by = u.id
        WHERE i.id = %s
    ''', (invoice_id,))
    invoice = cur.fetchone()

    cur.execute(
        'SELECT * FROM invoice_items WHERE invoice_id = %s',
        (invoice_id,)
    )
    inv_items = cur.fetchall()

    cur.execute('''
        SELECT p.*, u.name AS recorded_by_name
        FROM payments p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.invoice_id = %s
        ORDER BY p.payment_date DESC
    ''', (invoice_id,))
    payments = cur.fetchall()

    db.close()

    try:
        notify_admin_payment_received(
            customer_name=invoice['customer_name'],
            phone=invoice['phone'],
            invoice_number=invoice['invoice_number'],
            amount=amount,
            due_amount=float(invoice['due_amount']),
        )

        message_customer_payment_confirmed(
            name=invoice['customer_name'],
            phone=invoice['phone'],
            invoice_number=invoice['invoice_number'],
            paid=amount,
            remaining=float(invoice['due_amount']),
        )

    except Exception as _e:
        print(f'WhatsApp error (add_payment): {_e}')

    return jsonify({
        'message': 'Payment recorded',
        'invoice': invoice_to_dict(
            invoice,
            items=inv_items,
            payments=payments
        )
    }), 201



# ── Customers dropdown ────────────────────────────────────────────────────────

@billing_bp.route('/customers-list', methods=['GET'])
@jwt_required()
def customers_list():
    db  = get_db()
    cur = get_cursor(db)
    cur.execute('''
        SELECT e.id, e.name, e.phone, e.service
        FROM enquiries e
        WHERE e.status = 'Converted'
        ORDER BY e.name
    ''')
    customers = cur.fetchall()
    db.close()
    return jsonify([dict(c) for c in customers]), 200


# ── Stats Summary ─────────────────────────────────────────────────────────────

@billing_bp.route('/stats/summary', methods=['GET'])
@jwt_required()
def stats_summary():
    db  = get_db()
    cur = get_cursor(db)

    today       = datetime.now().strftime('%Y-%m-%d')
    month_start = datetime.now().strftime('%Y-%m-01')

    cur.execute(
        "SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE payment_date = %s",
        (today,)
    )
    revenue_today = float(cur.fetchone()['s'])

    cur.execute(
        "SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE payment_date >= %s",
        (month_start,)
    )
    revenue_month = float(cur.fetchone()['s'])

    cur.execute("SELECT COALESCE(SUM(due_amount), 0) AS s FROM invoices WHERE status NOT IN ('Paid', 'Cancelled')")
    total_due = float(cur.fetchone()['s'])

    cur.execute("SELECT COUNT(*) AS c FROM invoices")
    total_invoices = cur.fetchone()['c']

    cur.execute("SELECT COUNT(*) AS c FROM invoices WHERE status = 'Paid'")
    paid_count = cur.fetchone()['c']

    cur.execute("SELECT COUNT(*) AS c FROM invoices WHERE status = 'Partially Paid'")
    partial_count = cur.fetchone()['c']

    cur.execute("SELECT COUNT(*) AS c FROM invoices WHERE status = 'Draft'")
    draft_count = cur.fetchone()['c']

    cur.execute("SELECT COUNT(*) AS c FROM invoices WHERE status = 'Sent'")
    sent_count = cur.fetchone()['c']

    cur.execute("SELECT COALESCE(SUM(total_amount), 0) AS s FROM invoices WHERE status != 'Cancelled'")
    total_invoiced = float(cur.fetchone()['s'])

    db.close()
    return jsonify({
        'revenue_today':  round(revenue_today,  2),
        'revenue_month':  round(revenue_month,  2),
        'total_due':      round(total_due,       2),
        'total_invoiced': round(total_invoiced,  2),
        'total_invoices': total_invoices,
        'paid_count':     paid_count,
        'partial_count':  partial_count,
        'draft_count':    draft_count,
        'sent_count':     sent_count,
    }), 200


# ── Send Invoice Email ────────────────────────────────────────────────────────

@billing_bp.route('/<int:invoice_id>/send-email', methods=['POST'])
@jwt_required()
def send_invoice_email_route(invoice_id):
    """
    Manually triggered by admin clicking 'Send Email' on invoice detail.
    Sends invoice PDF to customer and notifies admin.
    """
    from email_service import send_invoice_email

    db  = get_db()
    cur = get_cursor(db)

    cur.execute('''
        SELECT i.*, u.name AS created_by_name FROM invoices i
        LEFT JOIN users u ON i.created_by = u.id WHERE i.id = %s
    ''', (invoice_id,))
    invoice = cur.fetchone()
    if not invoice:
        db.close()
        return jsonify({'error': 'Invoice not found'}), 404

    cur.execute('SELECT * FROM invoice_items WHERE invoice_id = %s ORDER BY id', (invoice_id,))
    items = cur.fetchall()

    cur.execute('''
        SELECT p.*, u.name AS recorded_by_name
        FROM payments p LEFT JOIN users u ON p.created_by = u.id
        WHERE p.invoice_id = %s ORDER BY p.payment_date DESC
    ''', (invoice_id,))
    payments = cur.fetchall()
    db.close()

    data           = request.get_json() or {}
    customer_email = data.get('customer_email', '').strip()

    # Also check if email is stored on invoice
    if not customer_email:
        customer_email = invoice.get('customer_email', '') or ''

    if not customer_email:
        return jsonify({'error': 'Customer email is required to send invoice'}), 400

    # Save email to invoice if not already saved
    if not invoice.get('customer_email'):
        db2  = get_db()
        cur2 = get_cursor(db2)
        cur2.execute(
            'UPDATE invoices SET customer_email = %s WHERE id = %s',
            (customer_email, invoice_id)
        )
        db2.commit()
        db2.close()

    result = send_invoice_email(
        invoice        = dict(invoice),
        items          = [dict(i) for i in items],
        payments       = [dict(p) for p in payments],
        customer_email = customer_email,
    )

    if result['customer']:
        return jsonify({
            'message': f'Invoice emailed to {customer_email}',
            'customer': result['customer'],
            'admin':    result['admin'],
        }), 200
    else:
        return jsonify({'error': 'Failed to send email. Check server logs.'}), 500