from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import psycopg2.extras
from database import get_db

inventory_bp = Blueprint('inventory', __name__)


def get_cursor(db):
    return db.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def is_admin(user_id):
    db  = get_db()
    cur = get_cursor(db)
    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    user = cur.fetchone()
    db.close()
    return user and user['role'] == 'admin'


# ─── PRODUCTS ────────────────────────────────────────────────────────────────

# FIX #5: Static sub-routes MUST come before <int:pid> dynamic route
# or Flask will try to cast 'low-stock'/'categories' as an integer and 404.

@inventory_bp.route('/products/low-stock', methods=['GET'])
@jwt_required()
def low_stock_products():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db  = get_db()
    cur = get_cursor(db)
    cur.execute('''
        SELECT * FROM products
        WHERE current_stock <= low_stock_threshold AND is_active = TRUE
        ORDER BY current_stock ASC
    ''')
    rows = cur.fetchall()
    db.close()
    result = []
    for r in rows:
        d = dict(r)
        for col in ('selling_price', 'cost_price', 'current_stock', 'low_stock_threshold'):
            if col in d and d[col] is not None:
                d[col] = float(d[col])
        result.append(d)
    return jsonify(result)


@inventory_bp.route('/products/categories', methods=['GET'])
@jwt_required()
def get_categories():
    """Returns merged list of defaults + all distinct categories in DB."""
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    defaults = ['Hardware', 'Software', 'Accessories',
                'Components', 'Peripherals', 'Networking', 'Storage', 'Other']

    db  = get_db()
    cur = get_cursor(db)
    cur.execute('SELECT DISTINCT category FROM products WHERE is_active = TRUE ORDER BY category')
    rows    = cur.fetchall()
    db.close()
    db_cats = [r['category'] for r in rows]
    merged  = list(dict.fromkeys(defaults + db_cats))
    return jsonify(merged)


@inventory_bp.route('/products/', methods=['GET'])
@jwt_required()
def list_products():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db  = get_db()
    cur = get_cursor(db)

    search    = request.args.get('search',    '').strip()
    category  = request.args.get('category',  '').strip()
    status    = request.args.get('status',    'active')   # active | inactive | all
    low_stock = request.args.get('low_stock', '')

    query  = "SELECT * FROM products WHERE 1=1"
    params = []

    if search:
        query += " AND (name ILIKE %s OR description ILIKE %s)"
        params += [f'%{search}%', f'%{search}%']

    if category:
        query += " AND category = %s"
        params.append(category)

    # FIX #2: Use TRUE/FALSE instead of 1/0 (proper PostgreSQL BOOLEAN)
    if status == 'active':
        query += " AND is_active = TRUE"
    elif status == 'inactive':
        query += " AND is_active = FALSE"

    if low_stock == '1':
        query += " AND current_stock <= low_stock_threshold"

    query += " ORDER BY name ASC"

    cur.execute(query, params)
    rows = cur.fetchall()
    db.close()

    def serialize_product(r):
        d = dict(r)
        for col in ('selling_price', 'cost_price', 'current_stock', 'low_stock_threshold'):
            if col in d and d[col] is not None:
                d[col] = float(d[col])
        return d

    return jsonify([serialize_product(r) for r in rows])


@inventory_bp.route('/products/', methods=['POST'])
@jwt_required()
def create_product():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    required = ['name', 'category', 'selling_price', 'cost_price']
    for field in required:
        if not data.get(field) and data.get(field) != 0:
            return jsonify({'error': f'{field} is required'}), 400

    # FIX #3: Cast to NUMERIC-safe float; validated before insert
    selling_price      = float(data['selling_price'])
    cost_price         = float(data['cost_price'])
    # FIX #6: Frontend sends 'opening_stock'; store as current_stock
    opening_stock      = float(data.get('opening_stock', 0))
    low_stock_threshold = float(data.get('low_stock_threshold', 5))

    if opening_stock < 0:
        return jsonify({'error': 'Opening stock cannot be negative'}), 400
    if selling_price < 0 or cost_price < 0:
        return jsonify({'error': 'Prices cannot be negative'}), 400

    db  = get_db()
    cur = get_cursor(db)

    cur.execute('''
        INSERT INTO products
            (name, category, description,
             selling_price, cost_price,
             current_stock, low_stock_threshold, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE)
        RETURNING id
    ''', (
        data['name'].strip(),
        data['category'].strip(),
        data.get('description', '').strip(),
        selling_price,
        cost_price,
        opening_stock,
        low_stock_threshold,
    ))
    new_id = cur.fetchone()['id']
    db.commit()

    cur.execute('SELECT * FROM products WHERE id = %s', (new_id,))
    product = cur.fetchone()
    db.close()
    d = dict(product)
    for col in ('selling_price', 'cost_price', 'current_stock', 'low_stock_threshold'):
        if col in d and d[col] is not None:
            d[col] = float(d[col])
    return jsonify(d), 201


@inventory_bp.route('/products/<int:pid>', methods=['GET'])
@jwt_required()
def get_product(pid):
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db  = get_db()
    cur = get_cursor(db)
    cur.execute('SELECT * FROM products WHERE id = %s', (pid,))
    product = cur.fetchone()
    db.close()
    if not product:
        return jsonify({'error': 'Product not found'}), 404
    d = dict(product)
    for col in ('selling_price', 'cost_price', 'current_stock', 'low_stock_threshold'):
        if col in d and d[col] is not None:
            d[col] = float(d[col])
    return jsonify(d)


@inventory_bp.route('/products/<int:pid>', methods=['PUT'])
@jwt_required()
def update_product(pid):
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT * FROM products WHERE id = %s', (pid,))
    product = cur.fetchone()
    if not product:
        db.close()
        return jsonify({'error': 'Product not found'}), 404

    data = request.get_json()

    # FIX #2: is_active stored as BOOLEAN — coerce incoming value safely
    raw_active = data.get('is_active', product['is_active'])
    is_active_val = bool(raw_active) if not isinstance(raw_active, bool) else raw_active

    # Validate new stock if provided
    new_stock = data.get('current_stock', data.get('opening_stock'))
    if new_stock is not None:
        new_stock = float(new_stock)
        if new_stock < 0:
            db.close()
            return jsonify({'error': 'Stock cannot be negative'}), 400
    else:
        new_stock = float(product['current_stock'])

    cur.execute('''
        UPDATE products SET
            name                = %s,
            category            = %s,
            description         = %s,
            selling_price       = %s,
            cost_price          = %s,
            current_stock       = %s,
            low_stock_threshold = %s,
            is_active           = %s,
            updated_at          = NOW()
        WHERE id = %s
    ''', (
        data.get('name',                product['name']),
        data.get('category',            product['category']),
        data.get('description',         product['description']),
        float(data.get('selling_price', product['selling_price'])),
        float(data.get('cost_price',    product['cost_price'])),
        new_stock,
        float(data.get('low_stock_threshold', product['low_stock_threshold'])),
        is_active_val,
        pid,
    ))
    db.commit()

    cur.execute('SELECT * FROM products WHERE id = %s', (pid,))
    updated = cur.fetchone()
    db.close()
    d = dict(updated)
    for col in ('selling_price', 'cost_price', 'current_stock', 'low_stock_threshold'):
        if col in d and d[col] is not None:
            d[col] = float(d[col])
    return jsonify(d)


@inventory_bp.route('/products/<int:pid>', methods=['DELETE'])
@jwt_required()
def deactivate_product(pid):
    """Soft delete — sets is_active = FALSE"""
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT id FROM products WHERE id = %s', (pid,))
    if not cur.fetchone():
        db.close()
        return jsonify({'error': 'Product not found'}), 404

    # FIX #2: Use TRUE/FALSE not 0/1
    cur.execute("UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = %s", (pid,))
    db.commit()
    db.close()
    return jsonify({'message': 'Product deactivated'})


# ─── PURCHASE ENTRIES ────────────────────────────────────────────────────────

@inventory_bp.route('/purchases/', methods=['GET'])
@jwt_required()
def list_purchases():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db  = get_db()
    cur = get_cursor(db)

    product_id = request.args.get('product_id', '')
    query  = '''
        SELECT pe.*, p.name AS product_name,
               u.name AS created_by_name
        FROM purchase_entries pe
        JOIN products p ON pe.product_id = p.id
        LEFT JOIN users u ON pe.created_by = u.id
        WHERE 1=1
    '''
    params = []
    if product_id:
        query += ' AND pe.product_id = %s'
        params.append(product_id)

    query += ' ORDER BY pe.created_at DESC'

    cur.execute(query, params)
    rows = cur.fetchall()
    db.close()

    def serialize_purchase(r):
        d = dict(r)
        for col in ('quantity', 'unit_cost', 'total_cost'):
            if col in d and d[col] is not None:
                d[col] = float(d[col])
        return d

    return jsonify([serialize_purchase(r) for r in rows])


@inventory_bp.route('/purchases/', methods=['POST'])
@jwt_required()
def create_purchase():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    data     = request.get_json()
    required = ['product_id', 'quantity', 'unit_cost', 'purchase_date']
    for field in required:
        if not data.get(field) and data.get(field) != 0:
            return jsonify({'error': f'{field} is required'}), 400

    product_id = int(data['product_id'])
    quantity   = float(data['quantity'])
    unit_cost  = float(data['unit_cost'])

    # FIX #3: Validate before storing
    if quantity <= 0:
        return jsonify({'error': 'Quantity must be greater than 0'}), 400
    if unit_cost < 0:
        return jsonify({'error': 'Unit cost cannot be negative'}), 400

    total_cost = round(quantity * unit_cost, 2)

    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT * FROM products WHERE id = %s', (product_id,))
    product = cur.fetchone()
    if not product:
        db.close()
        return jsonify({'error': 'Product not found'}), 404

    # Guard: can't use more stock than available
    if float(product['current_stock']) < quantity:
        db.close()
        return jsonify({'error': f'Insufficient stock. Available: {float(product["current_stock"])}'}), 400

    cur.execute('''
        INSERT INTO purchase_entries
            (product_id, quantity, unit_cost, total_cost,
             purchase_date, invoice_ref, notes, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    ''', (
        product_id, quantity, unit_cost, total_cost,
        data['purchase_date'],
        data.get('invoice_ref', '').strip(),
        data.get('notes',       '').strip(),
        user_id,
    ))
    new_id = cur.fetchone()['id']

    # Stock decreases — items are consumed/used
    cur.execute(
        "UPDATE products SET current_stock = current_stock - %s, updated_at = NOW() WHERE id = %s",
        (quantity, product_id)
    )

    db.commit()

    cur.execute('''
        SELECT pe.*, p.name AS product_name
        FROM purchase_entries pe
        JOIN products p ON pe.product_id = p.id
        WHERE pe.id = %s
    ''', (new_id,))
    entry = cur.fetchone()
    db.close()
    return jsonify(dict(entry)), 201


# FIX #4: Purchase edit + delete with stock correction
@inventory_bp.route('/purchases/<int:entry_id>', methods=['PUT'])
@jwt_required()
def update_purchase(entry_id):
    """Edit a purchase entry — adjusts stock by the delta quantity."""
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT * FROM purchase_entries WHERE id = %s', (entry_id,))
    existing = cur.fetchone()
    if not existing:
        db.close()
        return jsonify({'error': 'Purchase entry not found'}), 404

    data         = request.get_json()
    new_quantity = float(data.get('quantity',  existing['quantity']))
    new_cost     = float(data.get('unit_cost', existing['unit_cost']))

    if new_quantity <= 0:
        db.close()
        return jsonify({'error': 'Quantity must be greater than 0'}), 400

    # FIX #4: Stock delta — only adjust by the difference
    qty_delta  = new_quantity - float(existing['quantity'])
    total_cost = round(new_quantity * new_cost, 2)

    # Guard: if using MORE stock (qty_delta > 0), check enough is available
    cur.execute('SELECT current_stock FROM products WHERE id = %s', (existing['product_id'],))
    prod = cur.fetchone()
    if prod and qty_delta > 0 and float(prod['current_stock']) < qty_delta:
        db.close()
        return jsonify({'error': f'Insufficient stock for this edit. Available: {float(prod["current_stock"])}'}), 400

    cur.execute('''
        UPDATE purchase_entries SET
            quantity      = %s,
            unit_cost     = %s,
            total_cost    = %s,
            purchase_date = %s,
            invoice_ref   = %s,
            notes         = %s
        WHERE id = %s
    ''', (
        new_quantity, new_cost, total_cost,
        data.get('purchase_date', existing['purchase_date']),
        data.get('invoice_ref',   existing['invoice_ref'] or '').strip(),
        data.get('notes',         existing['notes']        or '').strip(),
        entry_id,
    ))

    # Positive delta = more consumed (decrease more); negative = less consumed (restore some)
    if qty_delta != 0:
        cur.execute(
            "UPDATE products SET current_stock = current_stock - %s, updated_at = NOW() WHERE id = %s",
            (qty_delta, existing['product_id'])
        )

    db.commit()

    cur.execute('''
        SELECT pe.*, p.name AS product_name
        FROM purchase_entries pe JOIN products p ON pe.product_id = p.id
        WHERE pe.id = %s
    ''', (entry_id,))
    updated = cur.fetchone()
    db.close()
    return jsonify(dict(updated))


@inventory_bp.route('/purchases/<int:entry_id>', methods=['DELETE'])
@jwt_required()
def delete_purchase(entry_id):
    """Delete a purchase entry and reverse the stock increment."""
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db  = get_db()
    cur = get_cursor(db)

    cur.execute('SELECT * FROM purchase_entries WHERE id = %s', (entry_id,))
    entry = cur.fetchone()
    if not entry:
        db.close()
        return jsonify({'error': 'Purchase entry not found'}), 404

    # Restore stock — add back quantity that was consumed
    cur.execute(
        "UPDATE products SET current_stock = current_stock + %s, updated_at = NOW() WHERE id = %s",
        (entry['quantity'], entry['product_id'])
    )
    cur.execute("DELETE FROM purchase_entries WHERE id = %s", (entry_id,))
    db.commit()
    db.close()
    return jsonify({'message': 'Purchase entry deleted and stock restored'})


@inventory_bp.route('/purchases/<int:product_id>/history', methods=['GET'])
@jwt_required()
def product_purchase_history(product_id):
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db  = get_db()
    cur = get_cursor(db)
    cur.execute('''
        SELECT pe.*, u.name AS created_by_name
        FROM purchase_entries pe
        LEFT JOIN users u ON pe.created_by = u.id
        WHERE pe.product_id = %s
        ORDER BY pe.created_at DESC
    ''', (product_id,))
    rows = cur.fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])


# ─── STATS ───────────────────────────────────────────────────────────────────

@inventory_bp.route('/stats/summary', methods=['GET'])
@jwt_required()
def inventory_summary():
    user_id = get_jwt_identity()
    if not is_admin(user_id):
        return jsonify({'error': 'Admin access required'}), 403

    db  = get_db()
    cur = get_cursor(db)

    cur.execute("SELECT COUNT(*) AS c FROM products WHERE is_active = TRUE")
    total_products = cur.fetchone()['c']

    cur.execute('''
        SELECT COUNT(*) AS c FROM products
        WHERE current_stock <= low_stock_threshold AND is_active = TRUE
    ''')
    low_stock_count = cur.fetchone()['c']

    cur.execute('''
        SELECT COALESCE(SUM(current_stock * cost_price), 0) AS v
        FROM products WHERE is_active = TRUE
    ''')
    stock_value = float(cur.fetchone()['v'])

    cur.execute("SELECT COUNT(*) AS c FROM purchase_entries")
    total_purchases = cur.fetchone()['c']

    cur.execute('''
        SELECT id, name, current_stock, low_stock_threshold
        FROM products
        WHERE current_stock <= low_stock_threshold AND is_active = TRUE
        ORDER BY current_stock ASC
        LIMIT 5
    ''')
    low_stock_items = cur.fetchall()

    db.close()

    def serialize_item(r):
        d = dict(r)
        for col in ('current_stock', 'low_stock_threshold'):
            if col in d and d[col] is not None:
                d[col] = float(d[col])
        return d

    return jsonify({
        'total_products':  total_products,
        'low_stock_count': low_stock_count,
        'stock_value':     round(stock_value, 2),
        'total_purchases': total_purchases,
        'low_stock_items': [serialize_item(r) for r in low_stock_items],
    })