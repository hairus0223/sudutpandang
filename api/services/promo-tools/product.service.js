import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getPromoToolsDb, getPromoToolsPaths } from "./db.js";
import { generateId, parseTags, PRODUCT_CATEGORIES } from "./utils.js";

/**
 * @param {string} publicHost
 * @param {string} relativePath
 */
export function buildPromoToolsFileUrl(publicHost, relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  return `http://${publicHost}/promo-tools/files/${normalized}`;
}

/**
 * @param {string} publicHost
 * @param {object} row
 * @param {object[]} images
 */
function mapProductRow(publicHost, row, images) {
  /** @type {string[]} */
  let tags = [];
  try {
    tags = JSON.parse(row.tags_json || "[]");
  } catch {
    tags = [];
  }

  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    price: row.price,
    promoPrice: row.promo_price ?? null,
    description: row.description,
    tags,
    stock: row.stock ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    images: images.map((img) => mapImageRow(publicHost, img)),
  };
}

/**
 * @param {string} publicHost
 * @param {object} row
 */
function mapImageRow(publicHost, row) {
  return {
    id: row.id,
    name: row.name,
    isPrimary: Boolean(row.is_primary),
    mimeType: row.mime_type,
    url: buildPromoToolsFileUrl(publicHost, row.file_path),
    thumbnailUrl: row.thumb_path
      ? buildPromoToolsFileUrl(publicHost, row.thumb_path)
      : buildPromoToolsFileUrl(publicHost, row.file_path),
    createdAt: row.created_at,
  };
}

function requireDb() {
  const db = getPromoToolsDb();
  if (!db) throw new Error("promo_tools_db_unavailable");
  return db;
}

function requirePaths() {
  const paths = getPromoToolsPaths();
  if (!paths) throw new Error("promo_tools_paths_unavailable");
  return paths;
}

/**
 * @param {string} productId
 */
function productImageDir(productId) {
  const { uploadDir } = requirePaths();
  return path.join(uploadDir, "products", productId);
}

/**
 * @param {string} publicHost
 * @param {string} productId
 */
function loadProductImages(publicHost, productId) {
  const db = requireDb();
  const images = db
    .prepare(
      `SELECT * FROM product_images
       WHERE product_id = ?
       ORDER BY is_primary DESC, created_at ASC`
    )
    .all(productId);
  return images.map((row) => mapImageRow(publicHost, row));
}

/**
 * @param {string} publicHost
 * @param {string} productId
 */
export function getProductById(publicHost, productId) {
  const db = requireDb();
  const row = db
    .prepare("SELECT * FROM products WHERE id = ? AND deleted_at IS NULL")
    .get(productId);
  if (!row) return null;
  const images = db
    .prepare(
      `SELECT * FROM product_images WHERE product_id = ?
       ORDER BY is_primary DESC, created_at ASC`
    )
    .all(productId);
  return mapProductRow(publicHost, row, images);
}

/**
 * @param {string} publicHost
 * @param {{ category?: string, search?: string }} [filters]
 */
export function listProducts(publicHost, filters = {}) {
  const db = requireDb();
  const clauses = ["deleted_at IS NULL"];
  /** @type {unknown[]} */
  const params = [];

  if (filters.category && PRODUCT_CATEGORIES.has(filters.category)) {
    clauses.push("category = ?");
    params.push(filters.category);
  }

  if (filters.search?.trim()) {
    const q = `%${filters.search.trim().toLowerCase()}%`;
    clauses.push(
      `(LOWER(name) LIKE ? OR LOWER(sku) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tags_json) LIKE ?)`
    );
    params.push(q, q, q, q);
  }

  const rows = db
    .prepare(
      `SELECT * FROM products
       WHERE ${clauses.join(" AND ")}
       ORDER BY updated_at DESC`
    )
    .all(...params);

  return rows.map((row) => {
    const images = db
      .prepare(
        `SELECT * FROM product_images WHERE product_id = ?
         ORDER BY is_primary DESC, created_at ASC`
      )
      .all(row.id);
    return mapProductRow(publicHost, row, images);
  });
}

/**
 * @param {string} publicHost
 * @param {Record<string, unknown>} input
 */
export function createProduct(publicHost, input) {
  const db = requireDb();
  const now = Date.now();
  const id = typeof input.id === "string" && input.id.trim() ? input.id.trim() : generateId();
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("invalid_name");

  const category = String(input.category ?? "lainnya");
  if (!PRODUCT_CATEGORIES.has(category)) throw new Error("invalid_category");

  const sku = String(input.sku ?? "").trim();
  if (sku) {
    const existing = db
      .prepare("SELECT id FROM products WHERE sku = ? AND deleted_at IS NULL")
      .get(sku);
    if (existing) throw new Error("duplicate_sku");
  }

  const price = Number(input.price) || 0;
  const promoPrice =
    input.promoPrice == null || input.promoPrice === ""
      ? null
      : Number(input.promoPrice);
  const stock =
    input.stock == null || input.stock === ""
      ? null
      : Number(input.stock);

  db.prepare(
    `INSERT INTO products (
      id, name, sku, category, price, promo_price, description, tags_json, stock,
      created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
  ).run(
    id,
    name,
    sku,
    category,
    price,
    promoPrice,
    String(input.description ?? ""),
    JSON.stringify(parseTags(input.tags)),
    stock,
    now,
    now
  );

  return getProductById(publicHost, id);
}

/**
 * @param {string} publicHost
 * @param {string} productId
 * @param {Record<string, unknown>} input
 */
export function updateProduct(publicHost, productId, input) {
  const db = requireDb();
  const existing = db
    .prepare("SELECT * FROM products WHERE id = ? AND deleted_at IS NULL")
    .get(productId);
  if (!existing) return null;

  const name =
    input.name != null ? String(input.name).trim() : existing.name;
  if (!name) throw new Error("invalid_name");

  const category =
    input.category != null ? String(input.category) : existing.category;
  if (!PRODUCT_CATEGORIES.has(category)) throw new Error("invalid_category");

  const sku = input.sku != null ? String(input.sku).trim() : existing.sku;
  if (sku) {
    const duplicate = db
      .prepare(
        "SELECT id FROM products WHERE sku = ? AND id != ? AND deleted_at IS NULL"
      )
      .get(sku, productId);
    if (duplicate) throw new Error("duplicate_sku");
  }

  const price = input.price != null ? Number(input.price) || 0 : existing.price;
  const promoPrice =
    input.promoPrice !== undefined
      ? input.promoPrice == null || input.promoPrice === ""
        ? null
        : Number(input.promoPrice)
      : existing.promo_price;
  const stock =
    input.stock !== undefined
      ? input.stock == null || input.stock === ""
        ? null
        : Number(input.stock)
      : existing.stock;
  const description =
    input.description != null ? String(input.description) : existing.description;
  const tags =
    input.tags != null
      ? JSON.stringify(parseTags(input.tags))
      : existing.tags_json;
  const now = Date.now();

  db.prepare(
    `UPDATE products SET
      name = ?, sku = ?, category = ?, price = ?, promo_price = ?,
      description = ?, tags_json = ?, stock = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    name,
    sku,
    category,
    price,
    promoPrice,
    description,
    tags,
    stock,
    now,
    productId
  );

  return getProductById(publicHost, productId);
}

/**
 * @param {string} productId
 */
export function deleteProduct(productId) {
  const db = requireDb();
  const existing = db
    .prepare("SELECT id FROM products WHERE id = ? AND deleted_at IS NULL")
    .get(productId);
  if (!existing) return false;

  const images = db
    .prepare("SELECT file_path, thumb_path FROM product_images WHERE product_id = ?")
    .all(productId);

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM product_images WHERE product_id = ?").run(productId);
    db.prepare("DELETE FROM products WHERE id = ?").run(productId);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  for (const img of images) {
    removeStoredFile(img.file_path);
    if (img.thumb_path) removeStoredFile(img.thumb_path);
  }

  const dir = productImageDir(productId);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }

  return true;
}

/**
 * @param {string | null | undefined} relativePath
 */
function removeStoredFile(relativePath) {
  if (!relativePath) return;
  const { uploadDir } = requirePaths();
  const fullPath = path.join(uploadDir, relativePath);
  try {
    fs.unlinkSync(fullPath);
  } catch {
    // ignore missing files
  }
}

/**
 * @param {string} publicHost
 * @param {string} productId
 * @param {{ buffer: Buffer, originalname?: string, mimetype?: string, isPrimary?: boolean }} file
 */
export async function addProductImage(publicHost, productId, file) {
  const db = requireDb();
  const product = db
    .prepare("SELECT id FROM products WHERE id = ? AND deleted_at IS NULL")
    .get(productId);
  if (!product) return null;

  const imageId = generateId();
  const dir = productImageDir(productId);
  fs.mkdirSync(dir, { recursive: true });

  const ext = mimeToExt(file.mimetype, file.originalname);
  const fileName = `${imageId}${ext}`;
  const thumbName = `${imageId}_thumb.webp`;
  const relativePath = path.join("products", productId, fileName);
  const thumbRelativePath = path.join("products", productId, thumbName);
  const absolutePath = path.join(dir, fileName);
  const thumbAbsolutePath = path.join(dir, thumbName);

  await sharp(file.buffer).rotate().toFile(absolutePath);
  await sharp(file.buffer)
    .rotate()
    .resize(480, 480, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(thumbAbsolutePath);

  const now = Date.now();
  const isPrimary = Boolean(file.isPrimary);
  const imageCount = db
    .prepare("SELECT COUNT(*) AS count FROM product_images WHERE product_id = ?")
    .get(productId);
  const shouldBePrimary = isPrimary || (imageCount?.count ?? 0) === 0;

  db.exec("BEGIN IMMEDIATE");
  try {
    if (shouldBePrimary) {
      db.prepare(
        "UPDATE product_images SET is_primary = 0 WHERE product_id = ?"
      ).run(productId);
    }

    db.prepare(
      `INSERT INTO product_images (
        id, product_id, name, file_path, thumb_path, mime_type, is_primary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      imageId,
      productId,
      file.originalname || fileName,
      relativePath.split(path.sep).join("/"),
      thumbRelativePath.split(path.sep).join("/"),
      file.mimetype || "image/jpeg",
      shouldBePrimary ? 1 : 0,
      now
    );

    db.prepare("UPDATE products SET updated_at = ? WHERE id = ?").run(now, productId);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    removeStoredFile(relativePath);
    removeStoredFile(thumbRelativePath);
    throw err;
  }

  const row = db.prepare("SELECT * FROM product_images WHERE id = ?").get(imageId);
  return mapImageRow(publicHost, row);
}

/**
 * @param {string} publicHost
 * @param {string} productId
 * @param {string} imageId
 */
export function deleteProductImage(publicHost, productId, imageId) {
  const db = requireDb();
  const row = db
    .prepare(
      "SELECT * FROM product_images WHERE id = ? AND product_id = ?"
    )
    .get(imageId, productId);
  if (!row) return false;

  db.prepare("DELETE FROM product_images WHERE id = ?").run(imageId);
  removeStoredFile(row.file_path);
  removeStoredFile(row.thumb_path);

  const remaining = db
    .prepare(
      "SELECT id FROM product_images WHERE product_id = ? ORDER BY created_at ASC"
    )
    .all(productId);

  if (remaining.length > 0 && row.is_primary) {
    db.prepare("UPDATE product_images SET is_primary = 1 WHERE id = ?").run(
      remaining[0].id
    );
  }

  db.prepare("UPDATE products SET updated_at = ? WHERE id = ?").run(
    Date.now(),
    productId
  );

  return true;
}

/**
 * @param {string | undefined} mime
 */
function mimeToExt(mime, originalName = "") {
  const normalized = (mime || "").toLowerCase();
  switch (normalized) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/heic":
    case "image/heif":
      return ".jpg";
    default: {
      const ext = path.extname(originalName || "").toLowerCase();
      if (ext === ".png") return ".png";
      if (ext === ".webp") return ".webp";
      if (ext === ".gif") return ".gif";
      return ".jpg";
    }
  }
}
