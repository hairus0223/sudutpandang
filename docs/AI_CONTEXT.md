# Sudut Pandang — AI Context

Concise context for AI-assisted work on this repo. **Under 300 lines by design.**

**Full docs:** [PROJECT_GUIDE.md](./PROJECT_GUIDE.md) · [TASK_WORKFLOW.md](./TASK_WORKFLOW.md) · [HIGH_VALUE_FILES.md](./HIGH_VALUE_FILES.md)

---

## What This Project Is

Local **self-photo studio** stack:

- **Operator UI** (`studio-kiosk`) — register customers, control sessions, gallery, print
- **Customer display** (`kiosk-app`) — fullscreen Electron kiosk, live preview, passive Socket listener
- **Backend** (`api`) — REST + Socket.IO + filesystem + capture watcher + PDF print

No database. No auth. LAN-trusted single-studio deployment.

---

## Architecture

### Three apps (loosely coupled monorepo)

```
studio-kiosk (Next.js :5173)  ──REST/Socket──►  api (Express :4000)  ◄──REST/Socket──  kiosk-app (Electron :5180)
                                                      │
                                                      ▼
                                            D:\SudutPandangStudio\
                                            capture/ → DD-MM-YYYY/<user>/
                                            headline/, print/
```

| App | Path | Stack |
|-----|------|-------|
| api | `api/server.js` | Express 5, Socket.IO, chokidar, Sharp, PDFKit |
| studio-kiosk | `studio-kiosk/` | Next.js 16, React 19, TS, Tailwind 4, Zustand, shadcn |
| kiosk-app | `kiosk-app/` | Electron 33, React 18, Vite, Socket.IO client |

### Control flow (do not violate)

1. Operator acts in **studio-kiosk** → calls **api** REST
2. Api updates in-memory session + emits **Socket.IO** → **kiosk-app** reacts
3. Camera/files land in `capture/` → chokidar moves to active user's folder
4. Gallery loads via `GET /api/images/:user` → print via canvas export → `POST /api/print`

### Routes & screens

| studio-kiosk | Purpose |
|--------------|---------|
| `/` | Headline gallery, register, access photo |
| `/session` | Operator session control |
| `/gallery?user=` | Photo gallery + print selection |
| `/print` | Print editor |

| kiosk-app screen | Purpose |
|------------------|---------|
| `idle` / `trial` / `main` / `end` | Customer display state machine |

### State

| Layer | Mechanism |
|-------|-----------|
| api | Module vars `activeSession`, `sessionLocked` |
| studio-kiosk | `useGalleryStore` (Zustand) + local React state |
| kiosk-app | `useState` + `useSessionTimer`, `useCameraPreview` |

### Critical files (read first)

1. `api/server.js`
2. `studio-kiosk/components/kiosk/SessionKioskClient.tsx`
3. `kiosk-app/src/renderer/App.jsx`
4. `studio-kiosk/stores/useGalleryStore.ts`
5. `studio-kiosk/components/print/PrintCanvas.tsx`

---

## Development Principles

1. **Plan before code** — implementation plan + reuse map; get approval first ([TASK_WORKFLOW.md](./TASK_WORKFLOW.md))
2. **Reuse over create** — extend existing components/services; no third copy of API `fetch`
3. **Minimal diff** — touch only files required; no drive-by refactors
4. **Architecture first** — operator → api → socket → kiosk; never kiosk-to-kiosk sync
5. **Implement order** — `api` → services → `studio-kiosk` → `kiosk-app`
6. **Match conventions** — TS strict in studio-kiosk; Indonesian user-facing copy
7. **No scope creep** — no database, auth, or new app unless explicitly requested
8. **Test manually** — no automated test suite; run E2E smoke after changes

---

## Coding Rules

### Languages

- **studio-kiosk:** TypeScript, `strict: true`, `"use client"` on interactive components
- **kiosk-app:** JavaScript JSX
- **api:** JavaScript ES modules (single `server.js`)

### Naming

- Components: `PascalCase` · Hooks/stores: `use*` · User slug: `name.replace(/\s+/g, "_")`
- Daily folders: `DD-MM-YYYY` under `BASE_DIR`

### UI (studio-kiosk)

- Tailwind + shadcn/ui (New York) + Radix + Lucide
- `cn()` from `lib/utils.ts` for classes
- `class-variance-authority` for button variants

### API calls

- Base URL: `lib/env.ts` (`NEXT_PUBLIC_API_URL`) or `kiosk-app/config.js` (`getApiBase()`)
- Use `fetch` + JSON — no React Query/SWR
- Extend `services/image.service.ts` or `kiosk-app/services/api.js` — **avoid inline fetch in components**

### State rules

- Gallery/print selection → **`useGalleryStore` only**
- Session timers on kiosk → **`useSessionTimer`**
- Do not duplicate `ImageData` / transform shapes

### Forbidden / deprecated

- Do **not** edit `kiosk-app/src/renderer/renderer.js` or `bundle.js` (legacy/build)
- Do **not** hardcode `192.168.x.x` outside env/config files
- Do **not** put Windows paths in frontend code
- Do **not** add `console.log` debug left in commits

---

## Reusable Services

### studio-kiosk

| Module | Use for |
|--------|---------|
| `services/image.service.ts` → `fetchImages`, `uploadImage` | User photo lists + upload |
| `lib/imageTypes.ts` → `GalleryImageData`, `ProcessingStatus` | Image typing |
| `stores/useGalleryStore.ts` | Images, print selection, transforms, filters, template |
| `lib/env.ts` → `API_BASE_URL` | All Next.js API URLs |
| `lib/printTemplates.ts` | `4R`, `4R_FULL` dimensions |
| `lib/resolvePaper.ts` + `hooks/useResolvedSheetPaper.ts` | Sheet margin override → printable area |
| `lib/sheetAdjustSelection.ts` + `lib/sheetAdjustMeta.ts` | Multi-slot selection + batch zoom/nudge |
| `utils/exportCanvas.ts` → `exportCanvasPrint()` | PNG export before print |
| `stores/useCanvasPanZoom.ts` → `useCanvasPanZoomPro()` | Canvas pan/zoom |

**Inline fetch (consolidate when touching):** `SessionKioskClient.tsx`, `HeadlineGallery.tsx`, `GalleryClient.tsx`, `PrintToolbar.tsx`

### kiosk-app

| Module | Use for |
|--------|---------|
| `services/api.js` | `fetchLatestImage`, `triggerBackendCapture`, session/register |
| `config.js` | `getApiBase()`, `fetchKioskConfig()` |
| `services/audio.js` → `useKioskAudio()` | Capture SFX on `new-photo` (shutter/success) + countdown beeps + MP3 session prompts |
| `hooks/useSessionTimer.js` | Countdown from `endsAt` |
| `hooks/useCameraPreview.js` | HDMI capture card live view |

### api (`server.js`)

| Concern | Location |
|---------|----------|
| All REST routes | Same file |
| Socket emits | Same file |
| Capture watcher | chokidar on `CAPTURE_DIR` → `captures/` |
| Studio config / health | `api/services/studioConfig.js` — `GET /api/health` |
| Print pipeline | Sharp → PDFKit → SumatraPDF |

### Package types

| Type | Session | AI generate |
|------|---------|-------------|
| `self-photo` | 10 min (default) | — |
| `ai-self-photo` | 12 min (default) | Quota = `peopleCount`; **1 tema per sesi** (register, locked immediately) |

Register sets `aiGenerateLimit`, `aiGenerateUsed`, `aiThemeId`, `aiThemeLockedAt`, `aiSelections[]` on `customer.json`.

**AI API:** `GET /api/ai-themes` · `PATCH /api/ai-theme/:user` (blocked when locked) · `POST /api/ai-generate` · `GET .../ai-status` · `GET /api/ai-quota/:user` · `GET /api/print-config/:user`  
**Sockets:** `ai-generation-progress`, `ai-generation-complete`  
**Kiosk sync** (trial/main/timer): `packageType`, `aiThemeId`, `aiThemeLabel`, `aiThemePreviewUrl`, `aiThemePreviewColor`, `aiThemeType`, `aiGenerateLimit`, `peopleCount`

**Pipeline:** semua tema AI Self Photo memakai **OpenAI Images Edits** (transform) dengan `transformPrompt` per tema.  
**Previews:** `GET /api/ai-themes` → `previewUrl`, optional `previewBeforeUrl`. Override `{BASE_DIR}/themes/{id}/` (see `themes/README.md` on bootstrap).  
**Katalog tema:** bundled `wild-west` + optional `{BASE_DIR}/config/ai-themes.json` (publish dari research lab).  
**Research lab (admin):** `POST /api/admin/ai-theme-research/preview` · `POST .../publish` — butuh `ADMIN_API_TOKEN` + header `X-Admin-Token`.  
**Gallery UX:** linear wizard — ① Pilih foto → ② Generate → ③ Hasil & cetak (`AiWizardStepper`). Theme picker **only at register** (`RegisterWizard` + `ThemePreviewCard`).  
**Print:** `printVariantByFilename` (`original`|`ai`); separate from AI quota.

**Analytics:** `{BASE_DIR}/data/ai-analytics.jsonl` · `GET /api/ai-analytics/summary?days=30`  
**QA:** [AI_SELF_PHOTO_QA.md](./AI_SELF_PHOTO_QA.md) · `npm run validate:ai-theme-previews`

---

## Reusable Components

### studio-kiosk — use first

| Component | Path | When |
|-----------|------|------|
| `PhotoCard` | `components/cards/PhotoCard.tsx` | Any photo grid/tile |
| `Button`, `Input` | `components/ui/` | Forms and actions |
| `PhotoModal` | `components/modals/PhotoModal.tsx` | Full-screen viewer |
| `BottomPrintBar` | `components/bottom/BottomPrintBar.tsx` | Print selection footer |
| `InfoCard` | `components/cards/InfoCard.tsx` | Gallery header |
| `AccessForm` | `components/kiosk/AccessForm.tsx` | Navigate to gallery |
| `HeadlineGallery` | `components/kiosk/HeadlineGallery.tsx` | Home page only |
| `PrintEditorLayout` | `components/print/editor/PrintEditorLayout.tsx` | 3-column print editor shell |
| `PrintLayoutPanel` | `components/print/editor/PrintLayoutPanel.tsx` | Sheet layout sidebar |
| `PrintInspectorPanel` | `components/print/editor/PrintInspectorPanel.tsx` | Adjust + filter sidebar |
| `TemplateSelector` | `components/print/TemplateSelector.tsx` | Template picker |
| `PrintCanvas` | `components/print/PrintCanvas.tsx` | Print preview/editor |
| `SessionKioskClient` | `components/kiosk/SessionKioskClient.tsx` | `/session` — `RegisterWizard`, theme cards |
| `GalleryAiWizard` | `components/gallery/GalleryAiWizard.tsx` | AI package gallery wizard |
| `AiWizardStepper` | `components/gallery/AiWizardStepper.tsx` | 3-step gallery flow |
| `ThemePreviewCard` | `components/kiosk/ThemePreviewCard.tsx` | Register theme picker |

### Print canvas utils (keep together)

`components/print/canvas/drawSmartCover.ts`, `draw4Rlayout.ts`, `drawFull4RLayout.ts`, `utils/canvasFilters.ts`, `utils/faceDetect.ts`, `utils/autoCenterPreset.ts`

### kiosk-app

| Component | Path |
|-----------|------|
| Main UI | `renderer/App.jsx` |
| `Button` | `renderer/components/ui/button.jsx` |

### Cross-app duplicate (do not add a 3rd)

`Button` + `cn()` exist in both apps — align or extract shared package later.

---

## Technical Constraints

### Environment

| Var | App | Default / notes |
|-----|-----|-----------------|
| `PORT` | api | `4000` |
| `NEXT_PUBLIC_API_URL` | studio-kiosk | fallback `http://192.168.1.10:4000` |
| `getApiBase()` / `__KIOSK_CONFIG__` | kiosk-app | Same LAN IP |
| `BASE_DIR` | api | `D:\SudutPandangStudio` (hardcoded in `server.js`) |
| `CAMERA_CAPTURE_COMMAND` | api | Optional shell shutter trigger |
| `SESSION_DURATION_MINUTES` | api | Default `10` |
| `AI_GENERATION_ENABLED` | api | Master switch for AI generate |
| `OPENAI_API_KEY` | api | OpenAI Images Edits API |
| `OPENAI_IMAGE_MODEL` | api | Default `gpt-image-1` |
| `OPENAI_IMAGE_INPUT_FIDELITY` | api | Transform edits; default `high` |
| `ADMIN_API_TOKEN` | api | Enables `/api/admin/ai-theme-research/*` (header `X-Admin-Token`) |
| `IMAGE_PROCESS_MIN_INTERVAL_MS` | api | Manual process rate limit (default 2000) |
| `IMAGE_PROCESS_MAX_JOBS_PER_USER` | api | Concurrent jobs per user (default 3) |
| `API_PUBLIC_HOST` | api | Host for image URLs in Socket payloads — **set LAN IP in production** |
| `UPLOAD_MAX_BYTES` | api | Upload limit (default 20MB) |

### Filesystem layout

```
BASE_DIR/
  capture/           ← Imaging Edge drop; watcher moves on active session
  headline/          ← marketing images
  print/             ← temp PDFs
  themes/            ← preview sample overrides (README on bootstrap)
  data/              ← ai-analytics.jsonl
  config/            ← ai-themes.json (published themes override)
  DD-MM-YYYY/
    <user_slug>/
      customer.json
      captures/
      processed/{imageId}/ai-{themeId}.jpg
```

### API surface (key endpoints)

`POST /api/register` · `GET /api/customer-by-name` · `POST /api/session/*` · `POST /api/kiosk/trial-start|trial-skip|main-start` · `GET /api/images/:user` · `GET /api/images/:user/:imageId/status` · `POST /api/images/:user/upload` · `GET /api/print-config/:user` · `POST /api/print` · `POST /api/capture` · `GET /api/kiosk-config` · `GET /api/headline` · `GET /api/health`

Legacy (disabled): `GET /api/themes`, `POST /api/images/:user/:imageId/process` → `404 not_available`

### Socket events (kiosk listens)

`kiosk-trial-start` · `kiosk-trial-skip` · `kiosk-main-start` · `session-ended` · `session-state` · `session-timer-update` · `new-photo`

Gallery also listens: `new-photo`

Unused in UI today: `session-paused`, `session-resumed`

### Known limitations (do not assume otherwise)

- Session state **lost on api restart**
- **Single api instance** — no horizontal scale
- **No auth** — open CORS `*`
- Electron **loads localhost:5180** in dev — production packaging incomplete
- `CameraService` in `main.js` is a **stub**
- Kiosk config key mismatch risk: `sessionDurationMinutes` (API) vs `sessionDurationSeconds` (config.js)
- `self-photo` + `ai-self-photo` packages; AI generation pipeline (OpenAI + bg removal + composite)
- Print copies forced to `1` in api (people-based logic commented out)

---

## Quick Decision Tree

```
New UI in operator app?
  → Existing component in components/ui or cards?
  → Need API? → Extend image.service or add to planned api-client
  → Gallery/print state? → useGalleryStore

New customer kiosk behavior?
  → Socket event from api + handler in App.jsx
  → Timer? → useSessionTimer
  → Camera? → useCameraPreview + optional IPC

New backend behavior?
  → api/server.js endpoint + Socket emit if kiosk must react
  → Filesystem under BASE_DIR + getTodayFolder()

New print template?
  → printTemplates.ts + draw layout + exportCanvas + api PDF dimensions (all must match)
```

---

## Run locally

```bash
cd api && node server.js                    # :4000 (Node 22+)
cd api && npm run validate:ai-theme-previews
cd api && npm run smoke-test                # API must be running
cd studio-kiosk && npm run dev              # :5173
cd studio-kiosk && npm run build
cd kiosk-app && npm run dev                 # :5180 + Electron
```

Manual AI E2E: [AI_SELF_PHOTO_QA.md](./AI_SELF_PHOTO_QA.md)

**Production:** copy `api/.env.production.example` → `api/.env`, set `API_PUBLIC_HOST` to studio LAN IP, set `studio-kiosk/.env.local` `NEXT_PUBLIC_API_URL` to same IP.

---

*Keep this file short. Update when architecture changes. Details live in PROJECT_GUIDE.md.*
