-- Promotion Tools — schema foundation (Phase 0)
-- Phase 1+ will add products, orders, transactions, etc.

CREATE TABLE IF NOT EXISTS promo_tools_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS promo_tools_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS promo_tools_schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO promo_tools_schema_meta (key, value, updated_at)
VALUES (
  'schema_version',
  '1',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
);
