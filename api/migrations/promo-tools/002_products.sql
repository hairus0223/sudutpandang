-- Phase 1: shared product catalog

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'lainnya',
  price REAL NOT NULL DEFAULT 0,
  promo_price REAL,
  description TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  stock INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_updated ON products(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL,
  thumb_path TEXT,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

INSERT OR REPLACE INTO promo_tools_schema_meta (key, value, updated_at)
VALUES (
  'schema_version',
  '2',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
);
