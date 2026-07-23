/**
 * Optional LAN admin token for research/publish endpoints.
 * Set ADMIN_API_TOKEN in api/.env and send header X-Admin-Token.
 */

/**
 * @returns {boolean}
 */
export function isAdminApiEnabled() {
  return Boolean(process.env.ADMIN_API_TOKEN?.trim());
}

/**
 * @returns {string | null}
 */
export function getAdminApiToken() {
  const token = process.env.ADMIN_API_TOKEN?.trim();
  return token || null;
}

/**
 * Express middleware — rejects when token missing or header mismatch.
 * @type {import("express").RequestHandler}
 */
export function requireAdminToken(req, res, next) {
  const expected = getAdminApiToken();
  if (!expected) {
    return res.status(503).json({
      ok: false,
      error: "admin_disabled",
      message: "Set ADMIN_API_TOKEN in api/.env to enable admin endpoints.",
    });
  }

  const provided = String(req.headers["x-admin-token"] ?? "").trim();
  if (!provided || provided !== expected) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  return next();
}
