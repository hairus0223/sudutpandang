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
  assert(health.body.mode === "studio", "expected studio mode");
  assert(
    Array.isArray(health.body.packages) && health.body.packages.includes("ai-self-photo"),
    "expected ai-self-photo in packages"
  );
  console.log(`✓ GET /api/health (packages: ${health.body.packages.join(", ")})`);

  const imageHealth = await fetchJson(base, "/api/health/image-processing");
  assert(
    imageHealth.status === 200 || imageHealth.status === 503,
    `/api/health/image-processing unexpected ${imageHealth.status}`
  );
  console.log("✓ GET /api/health/image-processing");

  const themes = await fetchJson(base, "/api/themes");
  assert(themes.status === 404, `/api/themes should return 404 (got ${themes.status})`);
  assert(themes.body.error === "not_available", "themes error payload missing");
  console.log("✓ GET /api/themes (disabled as expected)");

  const processRes = await fetch(`${base}/api/images/test-user/test-id/process`, {
    method: "POST",
    cache: "no-store",
  });
  const processBody = await processRes.json().catch(() => ({}));
  assert(processRes.status === 404, `/api/images/.../process should return 404 (got ${processRes.status})`);
  assert(processBody.error === "not_available", "process error payload missing");
  console.log("✓ POST /api/images/:user/:imageId/process (disabled as expected)");

  const kioskConfig = await fetchJson(base, "/api/kiosk-config");
  assert(kioskConfig.ok, `/api/kiosk-config failed (${kioskConfig.status})`);
  assert(
    kioskConfig.body.packageDurations?.["self-photo"],
    "packageDurations.self-photo missing"
  );
  assert(
    kioskConfig.body.packageDurations?.["ai-self-photo"],
    "packageDurations.ai-self-photo missing"
  );
  assert(
    Array.isArray(kioskConfig.body.packages) &&
      kioskConfig.body.packages.includes("ai-self-photo"),
    "kiosk packages missing ai-self-photo"
  );
  console.log(
    `✓ GET /api/kiosk-config (self-photo=${kioskConfig.body.packageDurations["self-photo"]}m, ai-self-photo=${kioskConfig.body.packageDurations["ai-self-photo"]}m)`
  );

  const aiThemes = await fetchJson(base, "/api/ai-themes");
  if (health.body.aiGeneration?.enabled) {
    assert(aiThemes.ok, `/api/ai-themes failed (${aiThemes.status})`);
    assert(Array.isArray(aiThemes.body.themes), "ai themes list missing");
    assert(aiThemes.body.themes.length >= 1, "expected at least one AI theme");
    const withPreview = aiThemes.body.themes.filter((t) => t.previewUrl);
    assert(withPreview.length >= 1, "expected at least one theme with previewUrl");
    assert(
      withPreview.length === aiThemes.body.themes.length,
      "every active theme should expose previewUrl"
    );

    for (const theme of aiThemes.body.themes) {
      assert(theme.type === "transform", `${theme.id}: type must be transform`);
      assert(theme.previewUrl, `${theme.id}: previewUrl missing`);
    }

    const wildWest = aiThemes.body.themes.find((t) => t.id === "wild-west");
    assert(wildWest, "expected wild-west theme in catalog");
    assert(wildWest.type === "transform", "wild-west should be transform type");
    assert(wildWest.previewUrl, "wild-west previewUrl missing");
    assert(wildWest.backgroundUrl, "wild-west backgroundUrl missing");
    assert(wildWest.backgroundThemeId === "wild-west", "wild-west backgroundThemeId mismatch");

    assert(wildWest.backgroundUrl.includes("/theme-backgrounds/"), "wild-west should use portrait photo background");
    assert(wildWest.backgroundSource === "photo", "wild-west backgroundSource should be photo");

    const bgRes = await fetch(wildWest.backgroundUrl, { cache: "no-store" });
    assert(bgRes.ok, `wild-west background not loadable (${bgRes.status})`);
    console.log("✓ GET wild-west theme-backgrounds asset");

    assert(aiThemes.body.themes.length >= 6, "expected at least 6 bundled AI themes");

    const samplePreview = withPreview[0].previewUrl;
    const previewHost = new URL(samplePreview).origin;
    const apiOrigin = new URL(base).origin;
    assert(
      previewHost === apiOrigin,
      `preview URL host mismatch (${previewHost} vs ${apiOrigin})`
    );

    const previewRes = await fetch(samplePreview, { cache: "no-store" });
    assert(previewRes.ok, `preview asset not loadable (${previewRes.status}): ${samplePreview}`);
    console.log(`✓ GET preview asset (${withPreview[0].id})`);

    if (wildWest?.previewBeforeUrl) {
      const beforeRes = await fetch(wildWest.previewBeforeUrl, { cache: "no-store" });
      assert(
        beforeRes.ok,
        `wild-west before preview not loadable (${beforeRes.status})`
      );
      console.log("✓ GET wild-west before preview asset");
    }

    console.log(
      `✓ GET /api/ai-themes (${aiThemes.body.themes.length} transform theme(s))`
    );
  } else {
    assert(aiThemes.status === 503, `/api/ai-themes should 503 when disabled (got ${aiThemes.status})`);
    console.log("✓ GET /api/ai-themes (disabled as expected)");
  }

  const analytics = await fetchJson(base, "/api/ai-analytics/summary?days=30");
  assert(analytics.ok, `/api/ai-analytics/summary failed (${analytics.status})`);
  assert(typeof analytics.body.generatesStarted === "number", "analytics summary missing");
  console.log("✓ GET /api/ai-analytics/summary");

  const promoHealth = await fetchJson(base, "/api/promo-tools/health");
  assert(
    promoHealth.status === 200 || promoHealth.status === 503,
    `/api/promo-tools/health unexpected ${promoHealth.status}`
  );
  assert(promoHealth.body.service === "promo-tools", "promo-tools service id missing");
  console.log(
    `✓ GET /api/promo-tools/health (db=${promoHealth.body.db?.ok ? "OK" : "FAIL"}, schema=v${promoHealth.body.schemaVersion ?? "?"})`
  );

  const promoMeta = await fetchJson(base, "/api/promo-tools/meta");
  assert(promoMeta.ok, `/api/promo-tools/meta failed (${promoMeta.status})`);
  assert(promoMeta.body.phase >= 3, "expected promo-tools phase 3+");
  assert(promoMeta.body.features?.products === true, "products feature should be enabled");
  assert(promoMeta.body.features?.orders === true, "orders feature should be enabled");
  console.log(`✓ GET /api/promo-tools/meta (api=${promoMeta.body.apiVersion}, phase=${promoMeta.body.phase})`);

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
