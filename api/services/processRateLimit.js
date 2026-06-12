const MIN_INTERVAL_MS =
  Number(process.env.IMAGE_PROCESS_MIN_INTERVAL_MS) || 2000;

const MAX_JOBS_PER_USER =
  Number(process.env.IMAGE_PROCESS_MAX_JOBS_PER_USER) || 3;

/** @type {Map<string, number>} */
const lastManualProcessAt = new Map();

/**
 * Rate limit manual POST /api/images/:user/:imageId/process (LAN-trusted guard).
 * @param {string} userSlug
 * @param {() => number} getActiveJobCount
 */
export function checkManualProcessAllowed(userSlug, getActiveJobCount) {
  const now = Date.now();
  const lastAt = lastManualProcessAt.get(userSlug) ?? 0;

  if (now - lastAt < MIN_INTERVAL_MS) {
    return {
      allowed: false,
      status: 429,
      error: "rate_limited",
      message: "Terlalu cepat. Tunggu sebentar sebelum memproses lagi.",
    };
  }

  const activeJobs = getActiveJobCount();
  if (activeJobs >= MAX_JOBS_PER_USER) {
    return {
      allowed: false,
      status: 429,
      error: "too_many_jobs",
      message:
        "Terlalu banyak proses foto berjalan untuk pengguna ini. Tunggu sebentar.",
    };
  }

  lastManualProcessAt.set(userSlug, now);

  return { allowed: true };
}

export function getProcessRateLimitConfig() {
  return {
    minIntervalMs: MIN_INTERVAL_MS,
    maxJobsPerUser: MAX_JOBS_PER_USER,
  };
}
