# Sudut Pandang — Technical Debt

Inventory of known technical debt, prioritized for a single-studio LAN deployment.

**Related:** [PROJECT_GUIDE.md](./PROJECT_GUIDE.md) · [HIGH_VALUE_FILES.md](./HIGH_VALUE_FILES.md) · [AI_CONTEXT.md](./AI_CONTEXT.md)

**Effort scale:** S = hours · M = 1–2 days · L = 3–5 days · XL = 1+ weeks

**Severity:** Critical · High · Medium · Low

---

## Summary by severity

| Severity | Count | Top themes |
|----------|-------|------------|
| Critical | 3 | Production Electron, monolithic api blast radius, session loss on restart |
| High | 7 | Duplicated API clients, no tests, Windows lock-in |
| Medium | 8 | Incomplete features, legacy code, print/gallery gaps |
| Low | 6 | Docs, deps hygiene, minor UX |

**Recently resolved (timer sync work):** #8 config key mismatch · #11 timer utilities (partial) · #20 pause/resume/add-time UI

---

## Debt register

### Architecture & infrastructure

| # | Technical debt | Severity | Recommended fix | Effort | Business impact |
|---|----------------|----------|-----------------|--------|-----------------|
| 1 | **Monolithic `api/server.js`** (~560 lines) — all routes, session, watcher, print, Socket in one file | High | Split into `routes/`, `services/session.js`, `services/print.js`, `services/capture-watcher.js`; keep `server.js` as bootstrap | L | Faster, safer changes to session vs print; fewer regression bugs during busy studio hours |
| 2 | **In-memory session state** — lost on API restart; single process only | Critical | Persist minimal session to JSON or SQLite; restore on boot; optional Redis only if multi-instance needed | M | API restart mid-session currently confuses operator + kiosk; customers may lose timed session |
| 3 | **Filesystem as database** — no query, backup strategy, or concurrency guarantees | Medium | Document backup of `BASE_DIR`; add file-lock or queue for capture moves; consider SQLite for metadata only | L | Risk of lost/corrupt `customer.json`; hard to report daily revenue or search customers |
| 4 | **No monorepo tooling** — empty root `package.json`, three independent installs | Low | npm workspaces or `concurrently` script: `dev:all`; shared `packages/types` | S | Slower onboarding; easy to run wrong app version against API |
| 5 | **No authentication** — open API + CORS `*` on LAN | High | PIN per operator session, or API key in env for write endpoints; restrict CORS to studio IPs | M | Anyone on LAN can register, control sessions, or trigger print — acceptable today only in trusted network |
| 6 | **Windows-hardcoded paths** — `D:\SudutPandangStudio`, SumatraPDF user path in `server.js` | High | `BASE_DIR`, `SUMATRA_PATH`, `PRINTER_NAME` via env; document macOS dev path | S | Cannot deploy or dev on Mac/Linux without code edits; printer path breaks on other PCs |

---

### Frontend & API integration

| # | Technical debt | Severity | Recommended fix | Effort | Business impact |
|---|----------------|----------|-----------------|--------|-----------------|
| 7 | **Duplicated API clients** — **Partially reduced** — session/kiosk calls in `session.service.ts`; register/images still inline in `SessionKioskClient`; other pages unchanged | High | Extend `session.service.ts` pattern to register/gallery/print; or `packages/api-client` | M | Same bug fixed in one place only; inconsistent error handling; slower feature work |
| 8 | ~~**Kiosk config key mismatch**~~ — **Resolved** — `config.js` maps `sessionDurationMinutes`; extended config includes `trialDurationSeconds` and `packageDurations` | — | — | — | — |
| 9 | **Hardcoded API URL** — `192.168.1.10:4000` fallback in `env.ts` and `config.js` | Medium | Require env in production; document `.env.example` per app | S | Studio move or IP change breaks all clients until manual edit |
| 10 | **`API_BASE` captured at module load** in `kiosk-app/services/api.js` | Medium | Resolve `getApiBase()` per request or lazy getter | S | Runtime `__KIOSK_CONFIG__` override ignored after first import |
| 11 | **Duplicated timer logic** — **Reduced** — `utils/time.ts` + `useSessionTimer` in operator UI; kiosk uses `syncFromServer` via Socket; `App.jsx` still has inline `remainingLabel` formatting | Low | Extract shared time util to kiosk-app or shared package | S | Minor display inconsistency only; live timers now server-synced |
| 12 | **Cross-app UI duplication** — `Button`, `cn()` in both apps | Low | Shared `packages/ui` or copy-once policy documented | M | Visual inconsistency between operator and customer apps over time |
| 13 | **React version split** — React 19 (studio-kiosk) vs 18 (kiosk-app) | Low | Align on 18 or 19 when Electron supports it | S | Subtle hook/typing differences for contributors |

---

### kiosk-app & hardware

| # | Technical debt | Severity | Recommended fix | Effort | Business impact |
|---|----------------|----------|-----------------|--------|-----------------|
| 14 | **Electron production packaging incomplete** — `main.js` always loads `http://localhost:5180` | Critical | Load `file://` bundled renderer or configurable `KIOSK_URL`; electron-builder config | L | Customer display cannot run reliably without dev server — blocks real deployment |
| 15 | **`CameraService` stub** — no real Sony / Imaging Edge integration in Electron | High | Implement `CAMERA_CAPTURE_COMMAND` parity; or SDK in `main.js` IPC | L | Capture depends entirely on external folder watch + manual trigger — fragile |
| 16 | **Second display assumption** — `displays[1]` or fallback to `[0]` | Medium | Config `DISPLAY_INDEX` env; settings UI for operator | S | Wrong monitor on single-display dev machines or unusual setups |
| 17 | **Capture card / getUserMedia fragility** — device busy errors (OBS, Imaging Edge) | Medium | Retry logic, clearer operator checklist, release stream before capture | S | Session interruptions; staff must troubleshoot during customer wait |

---

### Features incomplete or inconsistent

| # | Technical debt | Severity | Recommended fix | Effort | Business impact |
|---|----------------|----------|-----------------|--------|-----------------|
| 18 | **Dual session UIs** — `SessionKioskClient` (browser) vs `kiosk-app` (Electron) with different capture behavior | High | Single source of truth: operator controls only; kiosk passive; remove duplicate capture from `/session` or document as dev-only | M | Operator may think browser preview equals customer experience — support confusion |
| 19 | **`new-photo` Socket event unused** — gallery/session poll images instead | Medium | Subscribe in `GalleryClient` and/or `SessionKioskClient`; fallback poll | S | Delayed gallery refresh; extra API load from polling |
| 20 | ~~**Pause/resume/add-time APIs without UI**~~ — **Resolved** — Pause, Resume, +1 min, +5 min in `SessionKioskClient` via `session.service.ts` | — | — | — | — |
| 21 | **`ai-photo` package is UI-only** — no AI pipeline | Medium | Remove package or implement real processing + honest copy | L | Customer expectation mismatch if marketed as AI |
| 22 | **Print limit inconsistency** — register sets `printLimit: peopleCount`; `/api/print-limit` uses 2/3/5; print copies forced to `1` | Medium | Single rule in `customer.json` + api; restore people-based copies if intended | S | Customers may get wrong number of prints vs package promise |
| 23 | **`RegisterForm` on home vs `/session`** — home register does not start session | Low | Unify flows or label clearly (“register only”) | S | Staff register on home then wonder why session did not start |
| 24 | **`GET /api/print-limit` unused** — gallery uses `print-config` only | Low | Remove dead endpoint or use consistently | S | Confusion for maintainers |

---

### Print pipeline

| # | Technical debt | Severity | Recommended fix | Effort | Business impact |
|---|----------------|----------|-----------------|--------|-----------------|
| 25 | **Preview vs export layout duplication** — `PrintCanvas` vs `exportCanvas.ts` vs canvas drawers | High | Single render function used by preview and export | L | Physical prints differ from screen — customer complaints, reprints |
| 26 | **`FaceDetector` browser API** — limited support | Medium | Graceful fallback to center crop; optional server-side detect later | S | Auto-center fails silently in some browsers |
| 27 | **STRIP template commented out** — half-implemented | Low | Finish or delete `drawStrip.ts` and template entry | M | Dead code paths tempt partial enablement |
| 28 | **Large base64 print payloads** — 50mb limit, no chunking | Medium | Stream upload or server-side compose from image URLs | M | Print fails with many/high-res selections |

---

### Code quality & maintainability

| # | Technical debt | Severity | Recommended fix | Effort | Business impact |
|---|----------------|----------|-----------------|--------|-----------------|
| 29 | **No automated tests** — api, kiosk-app, studio-kiosk | High | Supertest for api routes; Playwright for gallery/print E2E; unit tests for `printChunk`, `drawSmartCover` | L | Every release is manual QA only; regressions in session/print are costly |
| 30 | **Legacy `renderer.js`** + committed **`bundle.js`** | Medium | Delete after confirming `App.jsx` + Vite build; remove from repo | S | Contributors edit wrong file; merge conflicts on bundle |
| 31 | **`.gitignore` minimal** — only `node_modules` | Medium | Add `.next/`, `dist/`, `bundle.js`, `.env` | S | Bloated repo; risk of committing build artifacts |
| 32 | **`SessionKioskClient.tsx` ~750 lines** | Medium | **Partially done** — API in `session.service.ts`, timer in `useSessionTimer`; still large due to `RegisterOrCheckScreen` inline | M | Hard to review session changes safely |
| 33 | **Debug logging in production paths** — e.g. config fetch, audio service | Low | Remove or gate behind `DEBUG` env | S | Noise in kiosk logs during sessions |
| 34 | **Spurious api dependencies** — `lucide-react`, `child_process` npm package | Low | Remove unused deps from `api/package.json` | S | Confusion, slightly slower installs |
| 35 | **`ImageData` type duplicated** in store, modal, export | Low | `types/photo.ts` shared import | S | Schema drift between gallery and print |
| 36 | **Silent error handling** — many `.catch(() => {})` | Medium | User-visible toast or operator alert for session/print failures | S | Failures invisible until customer complains |
| 37 | **README placeholder** — no setup link to docs | Low | Point README to `docs/PROJECT_GUIDE.md` | S | New contributors miss dev workflow |

---

## Recommended remediation roadmap

### Phase 1 — Stabilize operations (1–2 weeks)

| Priority | Items | Why |
|----------|-------|-----|
| P0 | #14 Electron production load | Unblocks real customer display |
| P0 | ~~#8 Config key mismatch~~ | Done — session timers aligned |
| P1 | #6 Env-based paths | Deploy on studio PC without fork |
| P1 | #31 `.gitignore` | Stop artifact churn |
| P1 | #30 Remove legacy renderer/bundle | Reduce confusion |

### Phase 2 — Reduce duplication (2–3 weeks)

| Priority | Items | Why |
|----------|-------|-----|
| P1 | #7 Shared api-client | Every future feature benefits |
| P2 | ~~#11 Timer utilities~~ | Done — server-synced timers; minor kiosk label duplication remains |
| P2 | #19 `new-photo` listener | Better gallery UX |
| P2 | ~~#20 Pause/resume UI~~ | Done — operator Pause/Resume/+1/+5 min |

### Phase 3 — Reliability & print quality (3–4 weeks)

| Priority | Items | Why |
|----------|-------|-----|
| P1 | #25 Preview/export parity | Core product quality |
| P1 | #29 API + E2E tests | Safe iteration |
| P2 | #2 Session persistence | Survive API restarts |
| P2 | #22 Print limits | Match business rules |

### Phase 4 — Architecture (optional, longer horizon)

| Priority | Items | Why |
|----------|-------|-----|
| P2 | #1 Split `server.js` | Maintainability at scale |
| P3 | #3 Metadata store | Reporting, search |
| P3 | #5 Auth | If studio network is shared |

---

## Debt consciously accepted (for now)

| Item | Rationale |
|------|-----------|
| No database | Single studio, filesystem sufficient until reporting needs grow |
| No auth | Trusted LAN; add when guest Wi‑Fi shares segment |
| Monorepo without shared package | Ship features first; extract when duplication hurts |
| In-memory session | OK if API runs as always-on Windows service |

Revisit when: second studio location, untrusted network, or daily ops pain exceeds fix cost.

---

*Last updated after timer sync phases 1–18 (session-timer-update, operator pause/resume, flexible durations). See [PROJECT_GUIDE.md](./PROJECT_GUIDE.md) § Session timer authority.*
