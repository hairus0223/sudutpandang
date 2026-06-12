/**
 * Smoke test for Sudut Pandang API (production readiness).
 *
 * Usage:
 *   node server.js          # terminal 1
 *   npm run smoke-test      # terminal 2
 *
 *   node scripts/smoke-test.js --base http://192.168.1.10:4000
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

async function fetchJson(base, path) {
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const { base } = parseArgs(process.argv);
  console.log(`\n🔍 Smoke test → ${base}\n`);

  const health = await fetchJson(base, "/api/health");
  assert(health.ok, `/api/health failed (${health.status})`);
  assert(health.body.config, "health.config missing");
  console.log("✓ GET /api/health");

  const imageHealth = await fetchJson(base, "/api/health/image-processing");
  assert(
    imageHealth.status === 200 || imageHealth.status === 503,
    `/api/health/image-processing unexpected ${imageHealth.status}`
  );
  console.log(
    `✓ GET /api/health/image-processing (${imageHealth.body.backgroundRemoval?.enabled ? "bg enabled" : "bg disabled"}, bundledAssets=${imageHealth.body.config?.bundledThemeAssetsReady ? "OK" : "MISSING"})`
  );

  const themes = await fetchJson(base, "/api/themes");
  assert(themes.ok, `/api/themes failed (${themes.status})`);
  assert(Array.isArray(themes.body.themes), "themes array missing");
  assert(themes.body.themes.length >= 4, "expected WC2026 + classic themes");
  assert(Array.isArray(themes.body.categories), "theme categories missing");
  assert(themes.body.categories.length >= 2, "expected event + classic categories");

  const eventCategories = themes.body.categories.filter(
    (c) => c.kind === "event"
  );
  assert(eventCategories.length >= 1, "expected at least 1 event category");

  const wcThemes = themes.body.themes.filter(
    (t) => t.category === "world-cup-2026"
  );
  assert(wcThemes.length >= 4, "expected at least 4 WC2026 themes");

  console.log(
    `✓ GET /api/themes (${themes.body.themes.length} themes, ${themes.body.categories.length} categories, default=${themes.body.defaultThemeId})`
  );

  for (const category of themes.body.categories) {
    const status = category.assetsReady ? "OK" : "MISSING";
    console.log(
      `  · ${category.label} [${status}] (${category.themeCount} tema)`
    );
    if (!category.assetsReady) {
      console.warn(
        `⚠ Category ${category.id} assets incomplete — npm run generate:theme-assets -- --category ${category.id}`
      );
    }
  }

  const kioskConfig = await fetchJson(base, "/api/kiosk-config");
  assert(kioskConfig.ok, `/api/kiosk-config failed (${kioskConfig.status})`);
  console.log("✓ GET /api/kiosk-config");

  if (health.body.config?.wc2026AssetsReady === false) {
    console.warn(
      "⚠ WC2026 assets missing — run: npm run generate:wc2026-assets"
    );
  }

  if (health.body.config?.classicAssetsReady === false) {
    console.warn(
      "⚠ Classic theme assets missing — run: npm run generate:classic-assets"
    );
  }

  if (health.body.config?.bundledThemeAssetsReady === false) {
    console.warn(
      "⚠ Bundled theme assets incomplete — run: npm run generate:theme-assets"
    );
  }

  if (health.body.themeSourceStats?.gradient > 0) {
    console.warn(
      `⚠ Theme gradient fallback used ${health.body.themeSourceStats.gradient}× since startup`
    );
  }

  const classicWithAssets = themes.body.themes.filter(
    (t) => t.category === "classic" && t.assetAvailable
  );
  if (classicWithAssets.length < 5) {
    console.warn(
      `⚠ Only ${classicWithAssets.length}/5 classic themes have bundled assets`
    );
  }

  if (health.body.validation?.warnings?.length) {
    console.warn("\n⚠ Startup warnings:");
    for (const warning of health.body.validation.warnings) {
      console.warn(`  - ${warning}`);
    }
  }

  console.log("\n✅ Smoke test passed\n");
}

run().catch((err) => {
  console.error("\n❌ Smoke test failed:", err.message);
  process.exit(1);
});
