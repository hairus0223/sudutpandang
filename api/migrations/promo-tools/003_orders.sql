-- Phase 3: shared order queue

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL,
  service_type TEXT NOT NULL DEFAULT 'custom',
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  estimated_total REAL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'waiting',
  source_module TEXT NOT NULL DEFAULT 'manual',
  photo_workflow_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_number_unique ON orders(order_number);

INSERT OR REPLACE INTO promo_tools_schema_meta (key, value, updated_at)
VALUES (
  'schema_version',
  '3',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
);
