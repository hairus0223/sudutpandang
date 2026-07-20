import { getPromoToolsDb } from "./db.js";
import { generateId } from "./utils.js";

const ORDER_COUNTER_KEY = "order-queue-counter";
const VALID_STATUSES = new Set(["waiting", "processing", "done"]);

function requireDb() {
  const db = getPromoToolsDb();
  if (!db) throw new Error("promo_tools_db_unavailable");
  return db;
}

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function getSetting(db, key) {
  const row = db.prepare("SELECT value FROM promo_tools_settings WHERE key = ?").get(key);
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

function setSetting(db, key, value) {
  db.prepare(
    `INSERT OR REPLACE INTO promo_tools_settings (key, value, updated_at)
     VALUES (?, ?, ?)`
  ).run(key, JSON.stringify(value), Date.now());
}

function mapOrderRow(row) {
  /** @type {unknown} */
  let photoWorkflow = undefined;
  if (row.photo_workflow_json) {
    try {
      photoWorkflow = JSON.parse(row.photo_workflow_json);
    } catch {
      photoWorkflow = undefined;
    }
  }

  return {
    id: row.id,
    orderNumber: row.order_number,
    serviceType: row.service_type,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    description: row.description,
    estimatedTotal: row.estimated_total ?? null,
    notes: row.notes,
    status: row.status,
    sourceModule: row.source_module,
    photoWorkflow,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listOrders(filters = {}) {
  const db = requireDb();
  const clauses = [];
  /** @type {unknown[]} */
  const params = [];

  if (filters.status && VALID_STATUSES.has(filters.status)) {
    clauses.push("status = ?");
    params.push(filters.status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM orders ${where} ORDER BY created_at DESC`)
    .all(...params);

  return rows.map(mapOrderRow);
}

export function getOrderById(id) {
  const db = requireDb();
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  return row ? mapOrderRow(row) : null;
}

function readCounter(db) {
  const dateKey = todayKey();
  const saved = getSetting(db, ORDER_COUNTER_KEY);
  const sequence = saved?.dateKey === dateKey ? Number(saved.sequence || 0) : 0;
  return { dateKey, sequence };
}

function ensureCounterAtLeast(orderNumber) {
  const match = /^A-(\d{8})-(\d+)$/.exec(orderNumber);
  if (!match) return;
  const dateKey = match[1];
  const sequence = Number(match[2]);
  const db = requireDb();
  const saved = getSetting(db, ORDER_COUNTER_KEY);
  if (saved?.dateKey === dateKey && Number(saved.sequence || 0) >= sequence) return;
  setSetting(db, ORDER_COUNTER_KEY, { dateKey, sequence });
}

export function peekOrderNumber() {
  const db = requireDb();
  const { dateKey, sequence } = readCounter(db);
  return `A-${dateKey}-${String(sequence + 1).padStart(3, "0")}`;
}

export function generateOrderNumber() {
  const db = requireDb();
  const dateKey = todayKey();
  const saved = getSetting(db, ORDER_COUNTER_KEY);
  const sequence = saved?.dateKey === dateKey ? Number(saved.sequence || 0) + 1 : 1;
  setSetting(db, ORDER_COUNTER_KEY, { dateKey, sequence });
  return `A-${dateKey}-${String(sequence).padStart(3, "0")}`;
}

function normalizeOrderInput(input, existing = null) {
  const now = Date.now();
  const status = input.status ?? existing?.status ?? "waiting";
  if (!VALID_STATUSES.has(status)) throw new Error("invalid_status");

  return {
    id: input.id ?? existing?.id ?? generateId(),
    orderNumber:
      String(input.orderNumber ?? input.order_number ?? existing?.orderNumber ?? "").trim() ||
      generateOrderNumber(),
    serviceType: String(input.serviceType ?? input.service_type ?? existing?.serviceType ?? "custom"),
    customerName: String(
      input.customerName ?? input.customer_name ?? existing?.customerName ?? ""
    ),
    customerPhone: String(
      input.customerPhone ?? input.customer_phone ?? existing?.customerPhone ?? ""
    ),
    description: String(input.description ?? existing?.description ?? ""),
    estimatedTotal:
      input.estimatedTotal !== undefined
        ? input.estimatedTotal
        : input.estimated_total !== undefined
          ? input.estimated_total
          : existing?.estimatedTotal ?? null,
    notes: String(input.notes ?? existing?.notes ?? ""),
    status,
    sourceModule: String(
      input.sourceModule ?? input.source_module ?? existing?.sourceModule ?? "manual"
    ),
    photoWorkflow:
      input.photoWorkflow !== undefined
        ? input.photoWorkflow
        : input.photo_workflow !== undefined
          ? input.photo_workflow
          : existing?.photoWorkflow,
    createdAt: existing?.createdAt ?? input.createdAt ?? input.created_at ?? now,
    updatedAt: now,
  };
}

export function createOrder(input) {
  const db = requireDb();
  const order = normalizeOrderInput(input);

  if (input.orderNumber || input.order_number) {
    ensureCounterAtLeast(order.orderNumber);
  }

  db.prepare(
    `INSERT INTO orders (
      id, order_number, service_type, customer_name, customer_phone, description,
      estimated_total, notes, status, source_module, photo_workflow_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    order.id,
    order.orderNumber,
    order.serviceType,
    order.customerName,
    order.customerPhone,
    order.description,
    order.estimatedTotal,
    order.notes,
    order.status,
    order.sourceModule,
    order.photoWorkflow ? JSON.stringify(order.photoWorkflow) : null,
    order.createdAt,
    order.updatedAt
  );

  return getOrderById(order.id);
}

export function updateOrder(id, input) {
  const db = requireDb();
  const existing = getOrderById(id);
  if (!existing) return null;

  const order = normalizeOrderInput({ ...existing, ...input, id }, existing);

  db.prepare(
    `UPDATE orders SET
      order_number = ?, service_type = ?, customer_name = ?, customer_phone = ?,
      description = ?, estimated_total = ?, notes = ?, status = ?, source_module = ?,
      photo_workflow_json = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    order.orderNumber,
    order.serviceType,
    order.customerName,
    order.customerPhone,
    order.description,
    order.estimatedTotal,
    order.notes,
    order.status,
    order.sourceModule,
    order.photoWorkflow ? JSON.stringify(order.photoWorkflow) : null,
    order.updatedAt,
    id
  );

  return getOrderById(id);
}

export function updateOrderStatus(id, status) {
  if (!VALID_STATUSES.has(status)) throw new Error("invalid_status");
  return updateOrder(id, { status });
}

export function deleteOrder(id) {
  const db = requireDb();
  const result = db.prepare("DELETE FROM orders WHERE id = ?").run(id);
  return result.changes > 0;
}

export function replaceAllOrders(orders) {
  const db = requireDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("DELETE FROM orders");
    for (const raw of orders) {
      const order = normalizeOrderInput(raw);
      db.prepare(
        `INSERT INTO orders (
          id, order_number, service_type, customer_name, customer_phone, description,
          estimated_total, notes, status, source_module, photo_workflow_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        order.id,
        order.orderNumber,
        order.serviceType,
        order.customerName,
        order.customerPhone,
        order.description,
        order.estimatedTotal,
        order.notes,
        order.status,
        order.sourceModule,
        order.photoWorkflow ? JSON.stringify(order.photoWorkflow) : null,
        order.createdAt,
        order.updatedAt
      );
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
