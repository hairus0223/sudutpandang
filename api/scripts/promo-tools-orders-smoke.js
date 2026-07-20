/**
 * Smoke test for Promotion Tools orders API (Phase 3).
 *
 * Usage:
 *   node server.js                    # terminal 1
 *   node scripts/promo-tools-orders-smoke.js
 *   node scripts/promo-tools-orders-smoke.js --base http://192.168.1.10:4000
 */
const DEFAULT_BASE = process.env.SMOKE_TEST_BASE_URL || "http://localhost:4000";

function parseArgs(argv) {
  const args = { base: DEFAULT_BASE };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--base" && argv[i + 1]) {
      args.base = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

async function fetchJson(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const { base } = parseArgs(process.argv);
  console.log(`\n📋 Promo Tools orders smoke → ${base}\n`);

  const meta = await fetchJson(base, "/api/promo-tools/meta");
  assert(meta.ok, `/api/promo-tools/meta failed (${meta.status})`);
  assert(meta.body.features?.orders === true, "orders feature not enabled");
  assert(meta.body.phase >= 3, "expected phase 3+");
  console.log(`✓ meta phase=${meta.body.phase} schema=v${meta.body.schemaVersion}`);

  const peek = await fetchJson(base, "/api/promo-tools/orders/next-number");
  assert(peek.ok, `peek next-number failed (${peek.status})`);
  assert(/^A-\d{8}-\d{3}$/.test(peek.body.orderNumber), "invalid peek order number");
  console.log(`✓ GET /orders/next-number (peek) → ${peek.body.orderNumber}`);

  const reserved = await fetchJson(base, "/api/promo-tools/orders/next-number/reserve", {
    method: "POST",
  });
  assert(reserved.ok, `reserve next-number failed (${reserved.status})`);
  const orderNumber = reserved.body.orderNumber;
  console.log(`✓ POST /orders/next-number/reserve → ${orderNumber}`);

  const created = await fetchJson(base, "/api/promo-tools/orders", {
    method: "POST",
    body: JSON.stringify({
      orderNumber,
      serviceType: "custom",
      customerName: "Smoke Test",
      customerPhone: "08123456789",
      description: "Order uji smoke test",
      estimatedTotal: 50000,
      notes: "Auto smoke",
      status: "waiting",
      sourceModule: "manual",
    }),
  });
  assert(created.status === 201, `create order failed (${created.status})`);
  assert(created.body.order?.id, "created order id missing");
  const orderId = created.body.order.id;
  console.log(`✓ POST /orders → ${orderId}`);

  const listed = await fetchJson(base, "/api/promo-tools/orders?status=waiting");
  assert(listed.ok, `list orders failed (${listed.status})`);
  assert(
    listed.body.orders.some((item) => item.id === orderId),
    "created order not found in list"
  );
  console.log(`✓ GET /orders (${listed.body.count} items)`);

  const updated = await fetchJson(base, `/api/promo-tools/orders/${orderId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "processing", notes: "Sedang diproses" }),
  });
  assert(updated.ok, `update order failed (${updated.status})`);
  assert(updated.body.order.status === "processing", "status not updated");
  console.log("✓ PUT /orders/:id");

  const patched = await fetchJson(base, `/api/promo-tools/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "done" }),
  });
  assert(patched.ok, `patch status failed (${patched.status})`);
  assert(patched.body.order.status === "done", "patch status not applied");
  console.log("✓ PATCH /orders/:id/status");

  const deleted = await fetchJson(base, `/api/promo-tools/orders/${orderId}`, {
    method: "DELETE",
  });
  assert(deleted.ok, `delete order failed (${deleted.status})`);
  console.log("✓ DELETE /orders/:id");

  console.log("\n✅ Orders smoke test passed\n");
}

run().catch((err) => {
  console.error("\n❌ Orders smoke test failed:", err.message);
  process.exit(1);
});
