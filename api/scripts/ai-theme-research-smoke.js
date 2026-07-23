/**
 * Smoke test for AI Theme Research Lab admin API.
 *
 * Usage:
 *   ADMIN_API_TOKEN=dev-secret node server.js   # terminal 1
 *   ADMIN_API_TOKEN=dev-secret node scripts/ai-theme-research-smoke.js
 *
 *   node scripts/ai-theme-research-smoke.js --base http://192.168.1.10:4000 --token dev-secret
 */
const DEFAULT_BASE = process.env.SMOKE_TEST_BASE_URL || "http://localhost:4000";
const DEFAULT_TOKEN = process.env.ADMIN_API_TOKEN || "";

function parseArgs(argv) {
  const args = { base: DEFAULT_BASE, token: DEFAULT_TOKEN };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--base" && argv[i + 1]) {
      args.base = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--token" && argv[i + 1]) {
      args.token = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

/**
 * @param {string} base
 * @param {string} path
 * @param {{ method?: string, token?: string, body?: unknown }} [options]
 */
async function fetchJson(base, path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (options.token) {
    headers["X-Admin-Token"] = options.token;
  }

  const res = await fetch(`${base}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const { base, token } = parseArgs(process.argv);
  console.log(`\n🔬 AI Theme Research smoke → ${base}\n`);

  const adminHealth = await fetchJson(base, "/api/admin/health");
  assert(adminHealth.ok, `/api/admin/health failed (${adminHealth.status})`);
  assert(adminHealth.body.service === "admin", "admin service id missing");
  console.log(
    `✓ GET /api/admin/health (adminEnabled=${adminHealth.body.adminEnabled})`
  );

  const metaBlocked = await fetchJson(base, "/api/admin/ai-theme-research/meta");
  if (!token) {
    assert(
      metaBlocked.status === 503 || metaBlocked.status === 401,
      `expected 503/401 without token (got ${metaBlocked.status})`
    );
    console.log("✓ GET /meta blocked without token (pass — set --token to run full test)");
    console.log("\n✅ AI Theme Research smoke (partial) passed.\n");
    return;
  }

  assert(token, "ADMIN_API_TOKEN or --token required for full smoke test");

  const meta = await fetchJson(base, "/api/admin/ai-theme-research/meta", { token });
  assert(meta.ok, `/meta failed (${meta.status})`);
  assert(meta.body.service === "ai-theme-research", "research service id missing");
  console.log(`✓ GET /meta (drafts=${meta.body.draftCount}, samples=${meta.body.sampleCount})`);

  const created = await fetchJson(base, "/api/admin/ai-theme-research/drafts", {
    method: "POST",
    token,
    body: {
      workingTitle: "Smoke Test Viking",
      transformPrompt: "Transform into a realistic viking portrait while preserving identity.",
      negativePrompt: "cartoon, anime, low quality, blurry",
      notes: "automated smoke test",
    },
  });
  assert(created.status === 201, `create draft failed (${created.status})`);
  const draftId = created.body.draft?.id;
  assert(draftId, "draft id missing");
  console.log(`✓ POST /drafts (${draftId})`);

  const listed = await fetchJson(base, "/api/admin/ai-theme-research/drafts", { token });
  assert(listed.ok, `list drafts failed (${listed.status})`);
  assert(
    listed.body.drafts.some((draft) => draft.id === draftId),
    "created draft not in list"
  );
  console.log("✓ GET /drafts");

  const updated = await fetchJson(base, `/api/admin/ai-theme-research/drafts/${draftId}`, {
    method: "PUT",
    token,
    body: {
      workingTitle: "Smoke Test Viking v2",
      transformPrompt: "Transform into a realistic viking warrior while preserving identity.",
      negativePrompt: "cartoon, anime, low quality, blurry",
      notes: "updated",
    },
  });
  assert(updated.ok, `update draft failed (${updated.status})`);
  console.log("✓ PUT /drafts/:id");

  const published = await fetchJson(base, "/api/admin/ai-theme-research/publish", {
    method: "POST",
    token,
    body: {
      draftId,
      id: "smoke-test-viking",
      label: "Smoke Viking",
      description: "Tema uji otomatis — boleh dihapus dari config/ai-themes.json",
      previewColor: "#5C4033",
    },
  });
  assert(published.status === 201, `publish failed (${published.status})`);
  assert(published.body.theme?.id === "smoke-test-viking", "published theme id mismatch");
  console.log("✓ POST /publish");

  const aiThemes = await fetchJson(base, "/api/ai-themes");
  assert(aiThemes.ok, `/api/ai-themes failed after publish (${aiThemes.status})`);
  assert(
    aiThemes.body.themes.some((theme) => theme.id === "smoke-test-viking"),
    "published theme not visible in /api/ai-themes"
  );
  console.log("✓ GET /api/ai-themes includes published theme");

  const deleted = await fetchJson(base, `/api/admin/ai-theme-research/drafts/${draftId}`, {
    method: "DELETE",
    token,
  });
  assert(deleted.ok, `delete draft failed (${deleted.status})`);
  console.log("✓ DELETE /drafts/:id");

  console.log("\n✅ AI Theme Research smoke passed.\n");
  console.log(
    "Note: published theme smoke-test-viking remains in config/ai-themes.json — remove manually if undesired."
  );
}

run().catch((err) => {
  console.error("\n❌ AI Theme Research smoke failed:", err.message);
  process.exit(1);
});
