"""
Run this ONCE against your Supabase database to migrate existing inventory data.
  cd backend && python migrate_inventory.py
"""
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
DATABASE_URL = os.environ.get('DATABASE_URL')

conn = psycopg2.connect(DATABASE_URL)
cur  = conn.cursor()

print("Starting inventory schema migration...")

# Step 1: products table — handle is_active separately (default must be dropped first)
print("  [1/3] Migrating products table...")

# Drop the old integer default before casting
cur.execute("ALTER TABLE products ALTER COLUMN is_active DROP DEFAULT;")

# Now cast INTEGER -> BOOLEAN
cur.execute("ALTER TABLE products ALTER COLUMN is_active TYPE BOOLEAN USING (is_active::int::boolean);")

# Set the correct boolean default
cur.execute("ALTER TABLE products ALTER COLUMN is_active SET DEFAULT TRUE;")

# Migrate numeric columns (these don't have the same issue)
cur.execute("ALTER TABLE products ALTER COLUMN selling_price       TYPE NUMERIC(12,2) USING selling_price::numeric;")
cur.execute("ALTER TABLE products ALTER COLUMN cost_price          TYPE NUMERIC(12,2) USING cost_price::numeric;")
cur.execute("ALTER TABLE products ALTER COLUMN current_stock       TYPE NUMERIC(12,2) USING current_stock::numeric;")
cur.execute("ALTER TABLE products ALTER COLUMN low_stock_threshold TYPE NUMERIC(12,2) USING low_stock_threshold::numeric;")

conn.commit()
print("     ✅ products columns migrated")

# Step 2: purchase_entries table
print("  [2/3] Migrating purchase_entries table...")
cur.execute("ALTER TABLE purchase_entries ALTER COLUMN quantity   TYPE NUMERIC(12,2) USING quantity::numeric;")
cur.execute("ALTER TABLE purchase_entries ALTER COLUMN unit_cost  TYPE NUMERIC(12,2) USING unit_cost::numeric;")
cur.execute("ALTER TABLE purchase_entries ALTER COLUMN total_cost TYPE NUMERIC(12,2) USING total_cost::numeric;")
conn.commit()
print("     ✅ purchase_entries columns migrated")

# Step 3: Drop unit column if it exists
print("  [3/3] Dropping unit column (if exists)...")
cur.execute("ALTER TABLE products DROP COLUMN IF EXISTS unit;")
conn.commit()
print("     ✅ unit column dropped (or was already absent)")

# Verify
print("\nVerifying column types...")
cur.execute("""
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'products'
      AND column_name IN ('is_active','selling_price','cost_price','current_stock','low_stock_threshold')
    ORDER BY column_name;
""")
for col, dtype, default in cur.fetchall():
    print(f"  products.{col}: {dtype} (default: {default})")

cur.execute("""
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'purchase_entries'
      AND column_name IN ('quantity','unit_cost','total_cost')
    ORDER BY column_name;
""")
for col, dtype in cur.fetchall():
    print(f"  purchase_entries.{col}: {dtype}")

conn.close()
print("\n✅ Migration complete.")