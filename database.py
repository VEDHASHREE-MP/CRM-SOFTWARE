import psycopg2
import psycopg2.extras
from config import Config


def get_db():
    conn = psycopg2.connect(
        Config.DATABASE_URL,
        sslmode="require"
    )
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id           SERIAL PRIMARY KEY,
            name         TEXT NOT NULL,
            email        TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role         TEXT NOT NULL DEFAULT 'staff',
            is_active    INTEGER NOT NULL DEFAULT 1,
            created_at   TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
            created_by   INTEGER REFERENCES users(id)
        )
    ''')

    # Enquiries table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS enquiries (
            id             SERIAL PRIMARY KEY,
            name           TEXT NOT NULL,
            phone          TEXT NOT NULL,
            service        TEXT NOT NULL,
            source         TEXT NOT NULL,
            status         TEXT NOT NULL DEFAULT 'New',
            assigned_to    INTEGER REFERENCES users(id),
            notes          TEXT,
            follow_up_date TEXT,
            loyalty_tier   TEXT NOT NULL DEFAULT 'New',
            created_at     TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
            updated_at     TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
        )
    ''')

    # Notifications table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notifications (
            id          SERIAL PRIMARY KEY,
            user_id     INTEGER NOT NULL REFERENCES users(id),
            message     TEXT NOT NULL,
            type        TEXT DEFAULT 'reminder',
            is_read     INTEGER DEFAULT 0,
            enquiry_id  INTEGER REFERENCES enquiries(id),
            session_id  INTEGER,
            created_at  TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
        )
    ''')

    # Teams table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS teams (
            id         SERIAL PRIMARY KEY,
            name       TEXT NOT NULL UNIQUE,
            created_by INTEGER REFERENCES users(id),
            created_at TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
        )
    ''')

    # Team members junction table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS team_members (
            team_id  INTEGER NOT NULL REFERENCES teams(id),
            user_id  INTEGER NOT NULL REFERENCES users(id),
            added_at TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
            PRIMARY KEY (team_id, user_id)
        )
    ''')

    # Sessions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id                SERIAL PRIMARY KEY,
            enquiry_id        INTEGER REFERENCES enquiries(id),
            customer_name     TEXT NOT NULL,
            phone             TEXT NOT NULL,
            service           TEXT NOT NULL,
            session_date      TEXT NOT NULL,
            session_time      TEXT NOT NULL,
            duration          TEXT NOT NULL,
            mode              TEXT NOT NULL DEFAULT 'offline',
            location_or_link  TEXT,
            notes             TEXT,
            assigned_staff    INTEGER REFERENCES users(id),
            status            TEXT NOT NULL DEFAULT 'Scheduled',
            created_at        TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
            updated_at        TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
        )
    ''')

    # Invoices table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS invoices (
            id             SERIAL PRIMARY KEY,
            invoice_number TEXT NOT NULL UNIQUE,
            customer_name  TEXT NOT NULL,
            phone          TEXT NOT NULL,
            enquiry_id     INTEGER REFERENCES enquiries(id) ON DELETE SET NULL,
            session_id     INTEGER REFERENCES sessions(id)  ON DELETE SET NULL,
            subtotal       REAL NOT NULL DEFAULT 0,
            discount       REAL NOT NULL DEFAULT 0,
            gst_rate       REAL NOT NULL DEFAULT 0,
            gst_amount     REAL NOT NULL DEFAULT 0,
            total_amount   REAL NOT NULL DEFAULT 0,
            paid_amount    REAL NOT NULL DEFAULT 0,
            due_amount     REAL NOT NULL DEFAULT 0,
            status         TEXT NOT NULL DEFAULT 'Draft',
            notes          TEXT,
            created_by     INTEGER REFERENCES users(id),
            created_at     TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
            updated_at     TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
        )
    ''')

    # Invoice line items
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS invoice_items (
            id          SERIAL PRIMARY KEY,
            invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
            description TEXT NOT NULL,
            quantity    REAL NOT NULL DEFAULT 1,
            unit_price  REAL NOT NULL DEFAULT 0,
            amount      REAL NOT NULL DEFAULT 0
        )
    ''')

    # Payments table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS payments (
            id           SERIAL PRIMARY KEY,
            invoice_id   INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
            amount       REAL NOT NULL,
            payment_mode TEXT NOT NULL DEFAULT 'Cash',
            payment_date TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD')),
            notes        TEXT,
            created_by   INTEGER REFERENCES users(id),
            created_at   TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
        )
    ''')

    # Products table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id                  SERIAL PRIMARY KEY,
            name                TEXT NOT NULL,
            category            TEXT NOT NULL DEFAULT 'Other',
            description         TEXT,
            selling_price       NUMERIC(12,2) NOT NULL DEFAULT 0,
            cost_price          NUMERIC(12,2) NOT NULL DEFAULT 0,
            current_stock       NUMERIC(12,2) NOT NULL DEFAULT 0,
            low_stock_threshold NUMERIC(12,2) NOT NULL DEFAULT 5,
            is_active           BOOLEAN NOT NULL DEFAULT TRUE,
            created_at          TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
            updated_at          TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
        )
    ''')

    # Purchase entries table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS purchase_entries (
            id            SERIAL PRIMARY KEY,
            product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            quantity      NUMERIC(12,2) NOT NULL,
            unit_cost     NUMERIC(12,2) NOT NULL DEFAULT 0,
            total_cost    NUMERIC(12,2) NOT NULL DEFAULT 0,
            purchase_date TEXT NOT NULL DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD')),
            invoice_ref   TEXT,
            notes         TEXT,
            created_by    INTEGER REFERENCES users(id),
            created_at    TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
        )
    ''')

    # Invoice customers table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS invoice_customers (
            id           SERIAL PRIMARY KEY,
            name         TEXT NOT NULL,
            phone        TEXT NOT NULL UNIQUE,
            loyalty_tier TEXT NOT NULL DEFAULT 'New',
            created_at   TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
            updated_at   TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
        )
    ''')

    # Expenses table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS expenses (
            id           SERIAL PRIMARY KEY,
            title        TEXT NOT NULL,
            category     TEXT NOT NULL,
            amount       REAL NOT NULL,
            expense_date TEXT NOT NULL,
            notes        TEXT,
            created_by   INTEGER REFERENCES users(id),
            created_at   TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
            updated_at   TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
        )
    ''')

    # Returns table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS returns (
            id          SERIAL PRIMARY KEY,
            title       TEXT NOT NULL,
            amount      REAL NOT NULL,
            return_date TEXT NOT NULL,
            notes       TEXT,
            created_by  INTEGER REFERENCES users(id),
            created_at  TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
            updated_at  TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
        )
    ''')

    # Team enquiries table  (parallel to individual enquiries — not the staff teams table)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS team_enquiries (
            id          SERIAL PRIMARY KEY,
            team_name   TEXT NOT NULL,
            service     TEXT NOT NULL,
            source      TEXT NOT NULL DEFAULT 'Walk-in',
            notes       TEXT,
            status      TEXT NOT NULL DEFAULT 'New',
            assigned_to INTEGER REFERENCES users(id),
            created_at  TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')),
            updated_at  TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'))
        )
    ''')

    # Individual members belonging to a team enquiry
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS team_enquiry_members (
            id      SERIAL PRIMARY KEY,
            team_id INTEGER NOT NULL REFERENCES team_enquiries(id) ON DELETE CASCADE,
            name    TEXT NOT NULL,
            phone   TEXT,
            email   TEXT
        )
    ''')

    # Session members — which team members attended a team session
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS session_members (
            id         SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            member_id  INTEGER NOT NULL REFERENCES team_enquiry_members(id) ON DELETE CASCADE,
            UNIQUE (session_id, member_id)
        )
    ''')

    conn.commit()

    # ── Migrations for existing DBs ────────────────────────────────────────────

    # Add is_active to users if missing (older schemas may not have it)
    try:
        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1
        """)
        conn.commit()
        print("  ✅ Migration: users.is_active ensured")
    except Exception:
        conn.rollback()

    # Add created_by to users if missing
    try:
        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)
        """)
        conn.commit()
        print("  ✅ Migration: users.created_by ensured")
    except Exception:
        conn.rollback()

    # Rename users.password → users.password_hash if old schema is present
    try:
        cursor.execute("""
            ALTER TABLE users RENAME COLUMN password TO password_hash
        """)
        conn.commit()
        print("  ✅ Migration: users.password renamed to users.password_hash")
    except Exception:
        conn.rollback()   # Already named password_hash — nothing to do

    # Add loyalty_tier to enquiries if missing
    try:
        cursor.execute("""
            ALTER TABLE enquiries
            ADD COLUMN IF NOT EXISTS loyalty_tier TEXT NOT NULL DEFAULT 'New'
        """)
        conn.commit()
    except Exception:
        conn.rollback()

    # Add customer_email to invoices if missing
    try:
        cursor.execute("""
            ALTER TABLE invoices
            ADD COLUMN IF NOT EXISTS customer_email TEXT
        """)
        conn.commit()
        print("  ✅ Migration: invoices.customer_email ensured")
    except Exception:
        conn.rollback()

    # Drop NOT NULL on sessions.enquiry_id to allow walk-in / direct bookings
    try:
        cursor.execute("""
            ALTER TABLE sessions
            ALTER COLUMN enquiry_id DROP NOT NULL
        """)
        conn.commit()
        print("  ✅ Migration: sessions.enquiry_id is now nullable (walk-in bookings enabled)")
    except Exception:
        conn.rollback()

    # Add team_id to sessions to support team bookings
    try:
        cursor.execute("""
            ALTER TABLE sessions
            ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES team_enquiries(id) ON DELETE SET NULL
        """)
        conn.commit()
        print("  ✅ Migration: sessions.team_id ensured")
    except Exception:
        conn.rollback()

    # Seed default admin if not exists
    from werkzeug.security import generate_password_hash
    try:
        cursor.execute("SELECT id FROM users WHERE email = 'admin@virtualtech.com'")
        existing = cursor.fetchone()
        if not existing:
            cursor.execute('''
                INSERT INTO users (name, email, password_hash, role)
                VALUES (%s, %s, %s, %s)
            ''', (
                'Admin',
                'admin@virtualtech.com',
                generate_password_hash('admin@123'),
                'admin'
            ))
            conn.commit()
            print("  ✅ Default admin seeded: admin@virtualtech.com / admin@123")
    except Exception as e:
        conn.rollback()
        print(f"  ⚠️  Admin seed skipped: {e}")

    conn.close()
    print("✅ Database initialized")