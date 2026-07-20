/**
 * Smoke test for Promotion Tools products API (Phase 1).
 *
 * Usage:
 *   node server.js                    # terminal 1
 *   node scripts/promo-tools-products-smoke.js
 *   node scripts/promo-tools-products-smoke.js --base http://192.168.1.10:4000
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

/** Minimal 1x1 PNG */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function run() {
  const { base } = parseArgs(process.argv);
  console.log(`\n🛒 Promo Tools products smoke → ${base}\n`);

  const meta = await fetchJson(base, "/api/promo-tools/meta");
  assert(meta.ok, `/api/promo-tools/meta failed (${meta.status})`);
  assert(meta.body.features?.products === true, "products feature not enabled");
  assert(meta.body.phase === 1, "expected phase 1");
  console.log(`✓ meta phase=${meta.body.phase} schema=v${meta.body.schemaVersion}`);

  const created = await fetchJson(base, "/api/promo-tools/products", {
    method: "POST",
    body: JSON.stringify({
      name: "Smoke Test Produk",
      sku: `SMOKE-${Date.now()}`,
      category: "atk",
      price: 12500,
      promoPrice: 10000,
      description: "Produk uji smoke test",
      tags: ["smoke", "test"],
      stock: 3,
    }),
  });
  assert(created.status === 201, `create product failed (${created.status})`);
  assert(created.body.product?.id, "created product id missing");
  const productId = created.body.product.id;
  console.log(`✓ POST /products → ${productId}`);

  const listed = await fetchJson(base, "/api/promo-tools/products?search=Smoke");
  assert(listed.ok, `list products failed (${listed.status})`);
  assert(
    listed.body.products.some((item) => item.id === productId),
    "created product not found in list"
  );
  console.log(`✓ GET /products (${listed.body.count} items)`);

  const updated = await fetchJson(base, `/api/promo-tools/products/${productId}`, {
    method: "PUT",
    body: JSON.stringify({ price: 15000, stock: 5 }),
  });
  assert(updated.ok, `update product failed (${updated.status})`);
  assert(updated.body.product.price === 15000, "price not updated");
  console.log("✓ PUT /products/:id");

  const form = new FormData();
  form.append("file", new Blob([TINY_PNG], { type: "image/png" }), "smoke.png");
  form.append("isPrimary", "true");

  const uploadRes = await fetch(`${base}/api/promo-tools/products/${productId}/images`, {
    method: "POST",
    body: form,
  });
  const uploadBody = await uploadRes.json().catch(() => ({}));
  assert(uploadRes.status === 201, `upload image failed (${uploadRes.status})`);
  assert(uploadBody.image?.url, "image url missing");
  console.log(`✓ POST /products/:id/images → ${uploadBody.image.url}`);

  const imageId = uploadBody.image.id;
  const deletedImage = await fetchJson(
    base,
    `/api/promo-tools/products/${productId}/images/${imageId}`,
    { method: "DELETE" }
  );
  assert(deletedImage.ok, `delete image failed (${deletedImage.status})`);
  console.log("✓ DELETE /products/:id/images/:imageId");

  const deleted = await fetchJson(base, `/api/promo-tools/products/${productId}`, {
    method: "DELETE",
  });
  assert(deleted.ok, `delete product failed (${deleted.status})`);
  console.log("✓ DELETE /products/:id");

  console.log("\n✅ Products smoke test passed\n");
}

run().catch((err) => {
  console.error("\n❌ Products smoke test failed:", err.message);
  process.exit(1);
});
