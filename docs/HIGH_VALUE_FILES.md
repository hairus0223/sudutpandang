# Sudut Pandang — High-Value Files

Top 20 files ranked by impact on system behavior, business flow, and maintainability.

**Companion docs:** [PROJECT_GUIDE.md](./PROJECT_GUIDE.md) · [TASK_WORKFLOW.md](./TASK_WORKFLOW.md)

Rankings reflect: centrality to architecture, number of features affected, blast radius of changes, and onboarding value.

---

## Summary Table

| Rank | File | App |
|------|------|-----|
| 1 | `api/server.js` | api |
| 2 | `studio-kiosk/components/kiosk/SessionKioskClient.tsx` | studio-kiosk |
| 3 | `kiosk-app/src/renderer/App.jsx` | kiosk-app |
| 4 | `studio-kiosk/stores/useGalleryStore.ts` | studio-kiosk |
| 5 | `studio-kiosk/components/print/PrintCanvas.tsx` | studio-kiosk |
| 6 | `studio-kiosk/components/GalleryClient.tsx` | studio-kiosk |
| 7 | `studio-kiosk/utils/exportCanvas.ts` | studio-kiosk |
| 8 | `studio-kiosk/components/print/PrintToolbar.tsx` | studio-kiosk |
| 9 | `studio-kiosk/lib/env.ts` | studio-kiosk |
| 10 | `kiosk-app/src/renderer/config.js` | kiosk-app |
| 11 | `kiosk-app/src/main.js` | kiosk-app |
| 12 | `kiosk-app/src/renderer/services/api.js` | kiosk-app |
| 13 | `studio-kiosk/components/kiosk/HeadlineGallery.tsx` | studio-kiosk |
| 14 | `kiosk-app/src/preload.js` | kiosk-app |
| 15 | `studio-kiosk/lib/printTemplates.ts` | studio-kiosk |
| 16 | `studio-kiosk/services/image.service.ts` | studio-kiosk |
| 17 | `kiosk-app/src/renderer/hooks/useSessionTimer.js` | kiosk-app |
| 18 | `kiosk-app/src/renderer/hooks/useCameraPreview.js` | kiosk-app |
| 19 | `studio-kiosk/components/print/canvas/drawSmartCover.ts` | studio-kiosk |
| 20 | `studio-kiosk/components/cards/PhotoCard.tsx` | studio-kiosk |

---

## 1. `api/server.js`

**Purpose:** Monolithic backend — REST API, in-memory session state, filesystem storage, capture folder watcher (chokidar), image/PDF print pipeline, Socket.IO hub, static file serving.

**Importance:** Single source of truth for the entire studio. Every registration, session, photo route, print job, and realtime event flows through this file. Understanding it explains ~80% of system behavior.

**When to modify:**
- Adding or changing API endpoints
- Session lifecycle (start, pause, trial/main kiosk events)
- Capture routing from `capture/` to user folders
- Print PDF generation or printer integration
- Socket.IO event names or payloads
- `BASE_DIR`, session duration, or env-driven config

**Risks:**
- **High blast radius** — one bug affects all clients
- In-memory session lost on restart; changes can desync operator and kiosk
- Windows-hardcoded paths (`D:\SudutPandangStudio`, SumatraPDF) break on other OSes
- chokidar + `activeSession` race conditions if session logic changes
- No tests — regressions easy to miss

---

## 2. `studio-kiosk/components/kiosk/SessionKioskClient.tsx`

**Purpose:** Operator session console — registration, lookup by name, trial/main kiosk commands, capture countdown, session timer, end session. Primary staff control surface.

**Importance:** Orchestrates the core revenue flow (register → trial → main → capture → end). Duplicates much API logic inline; largest frontend file for business logic.

**When to modify:**
- Operator session UX or new package types
- Trial/main button behavior or durations
- Registration form fields or validation
- Wiring new kiosk Socket commands from operator side
- Consolidating inline API helpers into a shared service

**Risks:**
- **~650 lines** — easy to break hook order or timer cleanup
- Inline `fetch` duplicates `RegisterForm` and `kiosk-app/services/api.js`
- Browser session timer and API session can drift if `endsAt` handling changes
- Capture here does not trigger Sony directly — assumptions about external capture must stay clear

---

## 3. `kiosk-app/src/renderer/App.jsx`

**Purpose:** Customer-facing fullscreen kiosk — screen state machine (`idle` → `trial` → `main` → `end`), Socket.IO listeners, capture countdown, live preview, package-aware UI (pas-photo frame, ai-photo messaging).

**Importance:** What the customer sees during a session. Must stay in sync with operator commands from `SessionKioskClient` via API Socket events.

**When to modify:**
- Customer display screens or copy
- Socket event handling (`kiosk-trial-start`, `kiosk-main-start`, `session-ended`)
- Capture countdown and review overlay behavior
- Package-specific overlays or messaging
- Listening for new events (e.g. `new-photo`)

**Risks:**
- Socket `useEffect` dependency array intentionally minimal — easy to introduce stale closures
- `sessionDurationMinutes` from config may not match API if `config.js` mapping is wrong
- Capture depends on backend + filesystem latency (1.5s poll for latest image)
- Changes here do not affect operator browser preview on `/session` — two surfaces to test

---

## 4. `studio-kiosk/stores/useGalleryStore.ts`

**Purpose:** Zustand store for gallery and print — images list, print selection, limits, template, per-photo transforms (scale, offset, filter), face boxes.

**Importance:** Shared state across gallery, modal, bottom bar, print canvas, and toolbar. Wrong store changes break the entire print pipeline.

**When to modify:**
- Print selection rules or `allowedPrint` integration
- New filter types or transform fields
- Default template or reset behavior
- Persisting editor state across navigation

**Risks:**
- Global client state — no persistence across full page reload
- `togglePrint` uses `alert()` — UX and test friction
- `ImageData` type duplicated in other files — schema drift
- Must keep in sync with `exportCanvas.ts` and `PrintCanvas.tsx` transform shape

---

## 5. `studio-kiosk/components/print/PrintCanvas.tsx`

**Purpose:** Interactive print preview — multi-page canvas, pan/zoom per photo slot, face detection hook-in, layout dispatch (`4R` vs `4R_FULL`), image caching.

**Importance:** Most complex UI subsystem. Bridges user edits in the store to pixels sent to the printer.

**When to modify:**
- New print templates or slot layouts
- Pan/zoom behavior or active slot selection
- Face-aware auto-center on load
- Print preview performance (blink, cache invalidation)
- Export vs preview mode differences

**Risks:**
- Large file with refs and canvas lifecycle — memory leaks if listeners not cleaned
- Tight coupling to `useCanvasPanZoomPro` and canvas draw utilities
- `FaceDetector` API not available in all browsers
- Subtle layout bugs affect physical print output

---

## 6. `studio-kiosk/components/GalleryClient.tsx`

**Purpose:** Gallery page orchestration — load images and print config, masonry grid, photo modal, print bar, navigation to `/print`.

**Importance:** Entry point for post-session workflow (review → select → print). Connects URL `?user=` to store and API.

**When to modify:**
- Gallery loading, empty states, or polling for new photos
- Print limit / template loading from API
- Grid layout or header actions
- Realtime refresh (e.g. Socket `new-photo`)

**Risks:**
- Requires `user` query param — missing user shows empty gallery silently
- Inline `fetch` for print-config — should stay aligned with `image.service.ts` patterns
- Store not reset on user change unless explicitly handled

---

## 7. `studio-kiosk/utils/exportCanvas.ts`

**Purpose:** Offscreen canvas export — builds final PNG data URLs from selected images, transforms, face boxes, and template id for `POST /api/print`.

**Importance:** Last client-side step before printing. Must match what `PrintCanvas` previews or customers get wrong output.

**When to modify:**
- Export resolution, chunking per page, or template branching
- New layouts in export path (must mirror preview drawers)
- Output format (PNG quality, color space hints)

**Risks:**
- Duplicated layout logic with `PrintCanvas` and `draw4Rlayout` / `drawFull4RLayout`
- Large base64 payloads — API 50mb limit and network timeouts
- Export without preview parity = production print bugs

---

## 8. `studio-kiosk/components/print/PrintToolbar.tsx`

**Purpose:** Print page toolbar — template selector, filter buttons, intensity slider, back navigation, submit print to API.

**Importance:** User-facing print confirmation and the only UI that calls `POST /api/print` from the operator app.

**When to modify:**
- Filter presets or apply-to-all behavior
- Print button flow, loading state, post-print navigation
- Printer name selection (if added)
- Error handling for failed prints

**Risks:**
- `resetSelection()` + `router.back()` timing can confuse if print fails mid-flight
- Applies filter from first image only for toolbar display — multi-image edge cases
- No retry or partial failure handling

---

## 9. `studio-kiosk/lib/env.ts`

**Purpose:** API base URL for Next.js app (`NEXT_PUBLIC_API_URL` with fallback `http://192.168.1.10:4000`).

**Importance:** Every studio-kiosk API call depends on this constant. Wrong URL = entire operator app offline.

**When to modify:**
- Deployment environments (dev/staging/studio LAN)
- Adding other public env vars (feature flags, analytics)

**Risks:**
- Hardcoded LAN IP in fallback — breaks for other networks if env not set
- `NEXT_PUBLIC_*` exposed to browser — no secrets here
- Must stay consistent with `kiosk-app/config.js`

---

## 10. `kiosk-app/src/renderer/config.js`

**Purpose:** Kiosk API base (`getApiBase()`, `window.__KIOSK_CONFIG__` override) and `fetchKioskConfig()` from `/api/kiosk-config`.

**Importance:** Connects Electron renderer to API and server-driven timer/countdown settings.

**When to modify:**
- API URL resolution for packaged Electron builds
- Mapping kiosk-config API fields to app config shape
- Default fallbacks when API unreachable

**Risks:**
- **Known bug risk:** API returns `sessionDurationMinutes` but mapper may use `sessionDurationSeconds` — timer wrong if not aligned
- Silent fallback to defaults on fetch failure hides misconfiguration
- Debug `console.log` left in production path

---

## 11. `kiosk-app/src/main.js`

**Purpose:** Electron main process — fullscreen window on second display, dev URL load, `CameraService` stub, IPC handlers for camera connect/capture.

**Importance:** Defines how the customer app runs in production (display targeting, security model, future Sony SDK integration).

**When to modify:**
- Production load strategy (file:// vs bundled URL vs localhost)
- Multi-monitor selection logic
- Real camera SDK / CLI integration in `CameraService`
- Window security (`contextIsolation`, preload path)

**Risks:**
- **Always loads `http://localhost:5180`** today — production packaging incomplete
- `CameraService.capture` is a stub — false sense of completion
- Display index assumptions (`displays[1]`) fail on single-monitor setups
- IPC surface must stay in sync with `preload.js`

---

## 12. `kiosk-app/src/renderer/services/api.js`

**Purpose:** Kiosk REST helpers — `registerCustomer`, `startSession`, `stopSession`, `fetchLatestImage`, `triggerBackendCapture`.

**Importance:** Canonical API client for Electron renderer (used by `App.jsx` for capture flow). Template for consolidating duplicated clients.

**When to modify:**
- New kiosk-side API calls
- Error handling or response typing
- Deprecating unused register/session calls if kiosk stays passive

**Risks:**
- `API_BASE` captured at module load — won't pick up runtime `__KIOSK_CONFIG__` changes without refactor
- Duplicates logic in `SessionKioskClient.tsx`
- Some exports unused in current passive-kiosk flow — dead code confusion

---

## 13. `studio-kiosk/components/kiosk/HeadlineGallery.tsx`

**Purpose:** Home page — rotating headline photo grid, entry buttons for session mode, access photo, register; hosts `AccessForm` / `RegisterForm` overlays.

**Importance:** First screen staff/customers see; marketing plus primary navigation hub.

**When to modify:**
- Headline rotation timing or slot count
- Home footer actions or new entry flows
- Headline fetch or empty state
- Linking registration to gallery/session

**Risks:**
- Complex `useEffect` + interval rotation — race conditions if headlines list small
- `RegisterForm` here does not start session (unlike `/session`) — behavior inconsistency by design
- Inline fetch — not using a shared headlines service

---

## 14. `kiosk-app/src/preload.js`

**Purpose:** Electron context bridge — exposes `window.kiosk.camera` (`connect`, `disconnect`, `capture`) to renderer safely.

**Importance:** Security boundary between renderer and main process; required for any native camera integration.

**When to modify:**
- New IPC capabilities (printer, fullscreen, file system)
- Renaming or extending camera API surface

**Risks:**
- Over-exposing IPC increases attack surface if renderer compromised
- Must match `main.js` handler names exactly
- Renderer code that checks `window.kiosk?.camera` fails silently if preload missing

---

## 15. `studio-kiosk/lib/printTemplates.ts`

**Purpose:** Print template definitions — `4R`, `4R_FULL` dimensions (px), DPI, labels; exported `PRINT_TEMPLATES` array.

**Importance:** Single definition of print sizes used by store default, template selector, canvas, and export. API `templateId` must align.

**When to modify:**
- Adding templates (strip, 2R, custom branding sizes)
- Changing dimensions or DPI for printer calibration

**Risks:**
- Must sync with `api/server.js` PDF dimensions for same `templateId`
- Wrong width/height breaks layout math in all canvas drawers
- Commented-out `STRIP` template — half-implemented features tempt partial enablement

---

## 16. `studio-kiosk/services/image.service.ts`

**Purpose:** `fetchImages(userId)` — GET `/api/images/:user` with `cache: "no-store"`.

**Importance:** Only dedicated API service module in studio-kiosk; pattern to follow when consolidating other fetches.

**When to modify:**
- Image list parsing, error types, or polling helpers
- Adding related endpoints (`headline`, `print-config`) here

**Risks:**
- Minimal surface — easy to bypass and add 5th duplicate inline fetch elsewhere
- Throws on non-OK — callers must catch (`GalleryClient` uses `console.error` only)

---

## 17. `kiosk-app/src/renderer/hooks/useSessionTimer.js`

**Purpose:** Countdown from `endsAt`, 1-minute warning callback, start/clear helpers for Socket-driven sessions.

**Importance:** Timer correctness drives session end UX and audio warnings on customer display.

**When to modify:**
- Warning threshold, tick interval, or sync with server `endsAt`
- Reusing in `SessionKioskClient` to replace duplicate timer logic

**Risks:**
- `onExpire` / `onWarn` in effect deps — parent should memoize callbacks
- Client clock skew vs server `endsAt` — session ends early/late
- Duplicated `msToMMSS` formatting in `SessionKioskClient` and `App.jsx`

---

## 18. `kiosk-app/src/renderer/hooks/useCameraPreview.js`

**Purpose:** `getUserMedia` live preview — prefers HDMI/capture card devices by label; optional Electron camera IPC connect.

**Importance:** Core self-photo experience on customer display; pas-photo frame overlays depend on stable video stream.

**When to modify:**
- Device selection heuristics (Elgato, USB capture cards)
- Resolution constraints or stream recovery after capture
- Integrating real Sony live view instead of capture card

**Risks:**
- `NotReadableError` when OBS/Imaging Edge holds device — user sees alert
- Restarting preview after capture required — some cameras freeze
- Browser permission prompts on kiosk startup — UX in fullscreen Electron

---

## 19. `studio-kiosk/components/print/canvas/drawSmartCover.ts`

**Purpose:** Cover-fit image drawing math (`getCoverSize`, `drawSmartCover`) — scale and crop photos into slots with transform offsets.

**Importance:** Shared geometry used by print layout, pan/zoom clamping (`useCanvasPanZoomPro`), and visual consistency across templates.

**When to modify:**
- Crop behavior (center vs face-weighted — face logic may live in callers)
- Performance of draw paths
- Supporting new aspect ratios

**Risks:**
- Math bugs affect every template using cover fit
- Changes ripple to `useCanvasPanZoom.ts` clamp bounds
- Canvas vs export must use same functions or output drifts

---

## 20. `studio-kiosk/components/cards/PhotoCard.tsx`

**Purpose:** Reusable photo tile — image display, optional print checkbox, optional filename, click handler; used in headline grid and gallery.

**Importance:** Highest reuse component in studio-kiosk; consistent selection UX across home and gallery.

**When to modify:**
- Selection UI, hover states, or lazy loading
- Props for headline vs gallery modes (`hidePrintToggle`, `hideFilename`)
- Accessibility or touch targets for kiosk displays

**Risks:**
- Tied to `useGalleryStore` when print toggle shown — breaks on pages without store provider
- Raw `<img>` — no Next.js Image optimization
- Used in masonry columns — layout quirks if aspect ratios vary wildly

---

## Files intentionally excluded (do not prioritize)

| File | Why excluded |
|------|----------------|
| `kiosk-app/src/renderer/renderer.js` | Legacy vanilla UI — superseded by `App.jsx` |
| `kiosk-app/src/renderer/bundle.js` | Build artifact — do not edit |
| `docs/PROJECT_GUIDE.md` | Documentation — important for humans, not runtime |
| `studio-kiosk/components/icons/*` | Branding only |
| `studio-kiosk/app/*/page.tsx` | Thin wrappers — logic lives in client components |

---

## Reading order for new contributors

```text
1. api/server.js
2. SessionKioskClient.tsx
3. kiosk-app/App.jsx
4. useGalleryStore.ts
5. GalleryClient.tsx → PrintCanvas.tsx → exportCanvas.ts
```

---

*Derived from [PROJECT_GUIDE.md](./PROJECT_GUIDE.md) analysis. Re-rank when architecture changes (e.g. shared `packages/api-client`, database, split `server.js`).*
