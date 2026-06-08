# Sudut Pandang — Project Guide

Local self-photo studio system: customers shoot on a fullscreen kiosk display, staff run registration, sessions, gallery, and printing from a web UI, backed by a Node.js API with filesystem storage and real-time sync.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Feature Map](#feature-map)
3. [Reusable Services](#reusable-services)
4. [Reusable Components](#reusable-components)
5. [Coding Conventions](#coding-conventions)
6. [Development Workflow](#development-workflow)

---

## Architecture

### Overview

Multi-app, loosely coupled monorepo with **no shared package** and **no database**. Three apps communicate via REST and Socket.IO.

```
┌─────────────────────┐     REST + Socket.IO     ┌─────────────────────┐
│   studio-kiosk      │ ◄──────────────────────► │        api          │
│   (Next.js)         │                          │   (Express + IO)    │
│   Operator UI       │                          │   Port 4000         │
│   Port 5173         │                          └──────────┬──────────┘
└─────────────────────┘                                     │
                                                            │ filesystem
┌─────────────────────┐     REST + Socket.IO                ▼
│   kiosk-app         │ ◄──────────────────────►   D:\SudutPandangStudio
│   (Electron)        │                            (capture/, images/, print/)
│   Customer display  │
│   Vite port 5180    │
└─────────────────────┘
```

### Apps

| App | Stack | Role |
|-----|-------|------|
| **api** | Node.js, Express 5, Socket.IO, Sharp, PDFKit, chokidar | Session hub, file watcher, image/PDF print pipeline |
| **studio-kiosk** | Next.js 16, React 19, TypeScript, Tailwind 4, Zustand, shadcn/ui | Operator: home gallery, registration, session control, photo gallery, print editor |
| **kiosk-app** | Electron 33, React 18, Vite, Socket.IO client | Customer fullscreen display: live preview, countdown, passive session listener |

### Control Flow

1. **Operator** (`studio-kiosk`) registers a customer and controls sessions.
2. **API** stores metadata on disk and emits Socket.IO events.
3. **Customer kiosk** (`kiosk-app`) listens and shows trial/main/end screens.
4. **Camera** drops files into `capture/`; API moves them to the active user's daily folder.
5. **Gallery → Print** loads images, edits on canvas, posts base64 PNGs to `/api/print`.

### State & Storage

| Layer | Approach |
|-------|----------|
| **api** | In-memory `activeSession` (lost on restart); filesystem for photos and `customer.json` |
| **studio-kiosk** | Zustand (`useGalleryStore`) + React local state |
| **kiosk-app** | React `useState` + custom hooks |

### Session timer authority

The **API** owns the canonical session timer (`activeSession.endsAt`, `pausedAt`, `remainingMs`, `phase`). Operator and customer displays sync from the server — they do not run independent countdown authorities.

| Source | Role |
|--------|------|
| `POST /api/session/*`, `POST /api/kiosk/*` | Mutate `activeSession` and emit Socket events |
| `session-timer-update` | Unified timer payload after any timer change |
| `session-state` on Socket connect | Restore timer after kiosk reconnect (`timer` field) |
| `GET /api/kiosk-config` | Defaults only (durations, countdown); not the live session timer |
| `useSessionTimer` (both apps) | Display layer: `endsAt - Date.now()`, pause freeze, 1-min warning |

**Operator** (`SessionKioskClient`): `session.service.ts` + `hooks/useSessionTimer.ts`; polls `GET /api/session` every 8s on preview; Pause / Resume / +1 min / +5 min buttons.

**Customer kiosk** (`App.jsx`): passive Socket listener; `syncFromServer` on `session-timer-update`, `session-paused`, `session-resumed`, and `session-state.timer`.

### Key Design Constraints

- Windows-centric paths (`D:\SudutPandangStudio`, SumatraPDF for silent print)
- No authentication (LAN-trusted)
- API base URL default: `http://192.168.1.10:4000`

---

## Feature Map

### Routes (studio-kiosk)

| Route | Purpose |
|-------|---------|
| `/` | Headline gallery, register, access photo, link to session mode |
| `/session` | Operator session control (register, lookup, trial/main, capture) |
| `/gallery?user=` | User photo gallery and print selection |
| `/print` | Print editor and submit to printer |

### kiosk-app Screens (no URL routes)

| Screen | Purpose |
|--------|---------|
| `idle` | Waiting for operator to start session |
| `trial` | Trial session with live preview and timer |
| `main` | Main session (package-aware UI) |
| `end` | Thank-you / session over |

### Features

| Feature | Purpose | Routes | Components | Services | API Endpoints |
|---------|---------|--------|------------|----------|---------------|
| **Headline Gallery** | Marketing photo wall on home | `/` | `HeadlineGallery`, `PhotoCard`, `AccessForm`, `RegisterForm` | Inline fetch | `GET /api/headline`, `GET /headline/*` |
| **Customer Registration** | Create daily user folder + metadata | `/`, `/session` | `RegisterForm`, `SessionKioskClient` | Inline fetch; `kiosk-app/services/api.js` | `POST /api/register` |
| **Customer Lookup** | Resume session for registered name | `/session` | `SessionKioskClient` | Inline `apiCustomerByName` | `GET /api/customer-by-name` |
| **Access Photo** | Open gallery by user slug | `/` → gallery | `AccessForm` | — | — |
| **Operator Session Control** | Staff runs timers, trial/main, pause/resume, capture | `/session` | `SessionKioskClient` | `session.service.ts`, `useSessionTimer` | `POST /api/session/*`, `POST /api/kiosk/*`, `GET /api/session`, `GET /api/images/:user` |
| **Customer Kiosk Display** | Fullscreen customer UX | kiosk screens | `kiosk-app/App.jsx`, hooks | `api.js`, `config.js`, Socket.IO | `GET /api/kiosk-config`, `POST /api/capture`, Socket events |
| **Kiosk Session Sync** | Push trial/main and timer updates to customer display | `/session` → Socket | `SessionKioskClient`, `App.jsx` | Socket.IO in api | `POST /api/kiosk/trial-start`, `trial-skip`, `main-start`; `session-timer-update` |
| **Live Camera Preview** | HDMI/capture card live view | kiosk trial/main | `useCameraPreview` | getUserMedia + optional Electron IPC | — |
| **Photo Capture** | Countdown, trigger shutter, show last shot | `/session`, kiosk | `SessionKioskClient`, `App.jsx` | `triggerBackendCapture`, `fetchLatestImage` | `POST /api/capture`, `GET /api/images/:user` |
| **Capture File Pipeline** | Move captures to user folder | backend | — | chokidar in `api/server.js` | Socket: `new-photo` |
| **Session Lifecycle** | Start/stop/pause/resume/add-time/expire | backend + operator + kiosk UI | `SessionKioskClient`, `App.jsx` | `session.service.ts`, in-memory in api | `GET/POST /api/session/*` |
| **User Photo Gallery** | Browse and select photos | `/gallery?user=` | `GalleryClient`, `PhotoCard`, `PhotoModal`, `BottomPrintBar` | `image.service.ts` | `GET /api/images/:user` |
| **Print Selection & Limits** | Enforce max printable photos | `/gallery` | `PhotoCard`, `useGalleryStore` | Zustand | `GET /api/print-config/:user` |
| **Print Editor** | Templates, filters, pan/zoom | `/print` | `PrintCanvas`, `PrintToolbar`, canvas utils | `exportCanvas.ts`, `useGalleryStore` | — |
| **Physical Print** | PNG → PDF → printer | `/print` | `PrintToolbar` | `exportCanvasPrint`, api Sharp/PDFKit | `POST /api/print` |
| **Package Types** | self-photo / pas-photo / ai-photo UX | `/session`, kiosk | `SessionKioskClient`, `App.jsx` | Stored in `customer.json` | `packageType` on register/session APIs |
| **Static Images** | Serve photos and headlines | — | Any `<img>` consumer | Express static | `GET /images/*`, `GET /headline/*` |

### Socket.IO Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `kiosk-trial-start` | API → kiosk | Start trial session on customer display |
| `kiosk-trial-skip` | API → kiosk | Skip trial, return to idle |
| `kiosk-main-start` | API → kiosk | Start main session |
| `session-timer-update` | API → clients | Unified timer sync: `{ user, endsAt, pausedAt, remainingMs, phase }` |
| `session-ended` | API → kiosk | End session |
| `session-state` | API → kiosk | On connect: `{ activeSession, sessionLocked, timer }` |
| `session-paused` | API → clients | Pause notification; kiosk also uses `session-timer-update` |
| `session-resumed` | API → clients | Resume with full `activeSession`; kiosk syncs timer |
| `new-photo` | API → clients | New file moved to user folder *(no UI listener yet)* |
| `session-started` | API → clients | Session registered *(operator-driven; kiosk uses timer events)* |

### `GET /api/kiosk-config` fields

| Field | Purpose |
|-------|---------|
| `sessionDurationMinutes` | Default main duration (env: `SESSION_DURATION_MINUTES`) |
| `captureCountdownSeconds` | Shutter countdown on kiosk |
| `trialDurationSeconds` | Default trial length (env: `TRIAL_DURATION_SECONDS`) |
| `packageDurations` | Per-package main duration in minutes: `{ self-photo, pas-photo, ai-photo }` |

Config drives **defaults and labels**; the live countdown on both displays comes from Socket timer events and `activeSession.endsAt`.

### Package Types

| Type | Main duration (default) | Kiosk behavior |
|------|-------------------------|----------------|
| `self-photo` | 10 min (`packageDurations`) | Standard self-photo |
| `pas-photo` | 5 min | Pas-photo frame overlay on live preview |
| `ai-photo` | 10 min | AI messaging on review (no AI pipeline in code) |

---

## Reusable Services

There is no shared package today. Reuse **within** each app, or extract to `packages/shared` when refactoring.

### studio-kiosk

| Service | Location | Use when |
|---------|----------|----------|
| `fetchImages(userId)` | `services/image.service.ts` | Loading user photos for gallery |
| Session/kiosk API | `services/session.service.ts` | `getSession`, `startSession`, `pauseSession`, `resumeSession`, `addTime`, `trialStart`, `mainStart`, `getKioskConfig` |
| `msToMMSS` | `utils/time.ts` | Format countdown display |
| `useSessionTimer` | `hooks/useSessionTimer.ts` | Operator timer display synced to server |
| `API_BASE_URL` | `lib/env.ts` | Any API call from Next.js app |
| `useGalleryStore` | `stores/useGalleryStore.ts` | Gallery + print selection, transforms, templates |
| Inline fetch | `SessionKioskClient.tsx` (register, images), `RegisterForm`, `HeadlineGallery`, `GalleryClient`, `PrintToolbar` | Feature-specific calls *(consolidate over time)* |

### kiosk-app

| Service | Location | Use when |
|---------|----------|----------|
| `registerCustomer`, `startSession`, `stopSession` | `services/api.js` | Kiosk registration/session (legacy; kiosk is mostly passive now) |
| `fetchLatestImage`, `triggerBackendCapture` | `services/api.js` | Post-capture preview and shutter trigger |
| `getApiBase`, `fetchKioskConfig` | `config.js` | API URL; defaults (`sessionDurationMinutes`, `trialDurationSeconds`, `packageDurations`, `captureCountdownSeconds`) |
| `useKioskAudio` | `services/audio.js` | Countdown beeps, shutter, warnings, session end |

### api (monolithic `server.js`)

| Logical service | Use when |
|-----------------|----------|
| `getTodayFolder()` | Building paths under `BASE_DIR` |
| Session + Socket emit | Any new session endpoint |
| chokidar capture watcher | Routing camera files to active user |
| `applyTemplate` / print PDF pipeline | Print variants or batch print |
| `silentPrint()` | Server-triggered printing |

### Recommended shared extractions

1. **`packages/api-client`** — all `/api/*` calls + TypeScript types
2. **`packages/types`** — `Customer`, `Session`, `ImageData`, `PackageType`, `PrintTemplate`
3. **`utils/time.ts`** — `msToMMSS` *(done in studio-kiosk; kiosk-app still has inline label formatting)*

---

## Reusable Components

### studio-kiosk — UI primitives (shadcn)

| Component | Path | Reuse when |
|-----------|------|------------|
| `Button` | `components/ui/button.tsx` | Any action button |
| `Input` | `components/ui/input.tsx` | Form fields |
| `Card` | `components/ui/card.tsx` | Content grouping |
| `Dialog` | `components/ui/dialog.tsx` | Modals |
| `Checkbox` | `components/ui/checkbox.tsx` | Boolean inputs |
| `ScrollToTop` | `components/ui/ScrollToTop.tsx` | Long scrollable pages |
| `cn()` | `lib/utils.ts` | Merging Tailwind classes |

### studio-kiosk — Feature components

| Component | Path | Reuse when |
|-----------|------|------------|
| `PhotoCard` | `components/cards/PhotoCard.tsx` | Photo grid with optional print toggle |
| `InfoCard` | `components/cards/InfoCard.tsx` | Branded gallery header |
| `PhotoModal` | `components/modals/PhotoModal.tsx` | Full-screen photo viewer |
| `BottomPrintBar` | `components/bottom/BottomPrintBar.tsx` | Print selection footer |
| `AccessForm` | `components/kiosk/AccessForm.tsx` | Navigate to gallery by name |
| `RegisterForm` | `components/kiosk/RegisterForm.tsx` | Simple home registration (no session) |
| `PrintCanvas` | `components/print/PrintCanvas.tsx` | Print layout editor |
| `PrintToolbar` | `components/print/PrintToolbar.tsx` | Filters + print submit |
| `TemplateSelector` | `components/print/TemplateSelector.tsx` | Switch 4R / 4R_FULL |

### studio-kiosk — Print canvas utilities

Reuse as a group when adding templates or export paths:

- `utils/exportCanvas.ts`, `utils/printChunk.ts`, `utils/canvasFilters.ts`
- `utils/faceDetect.ts`, `utils/autoCenterPreset.ts`, `utils/skinSmoothing.ts`
- `components/print/canvas/draw4Rlayout.ts`, `drawFull4RLayout.ts`, `drawSmartCover.ts`, etc.

### kiosk-app

| Component / Hook | Path | Reuse when |
|------------------|------|------------|
| `App` | `renderer/App.jsx` | Customer kiosk screen state machine |
| `useSessionTimer` | `hooks/useSessionTimer.js` | Timer from `endsAt`, 1-min warning |
| `useCameraPreview` | `hooks/useCameraPreview.js` | Live HDMI/capture card preview |
| `Button` | `components/ui/button.jsx` | Kiosk actions *(duplicate of studio-kiosk)* |
| `cn()` | `lib/cn.js` | Tailwind class merge |

### Cross-app duplicates (do not fork further)

- `Button` + `cn()` exist in both apps — prefer one shared design system when refactoring.

### App-specific (avoid reusing elsewhere)

- `SessionKioskClient` — large operator-only flow
- `HeadlineGallery` — home marketing rotation
- `kiosk-app/renderer.js` — **legacy**; use `App.jsx` instead

---

## Coding Conventions

### Languages

| App | Language | Strictness |
|-----|----------|------------|
| studio-kiosk | TypeScript | `strict: true` |
| kiosk-app | JavaScript (JSX) | No strict TS |
| api | JavaScript (ES modules) | None |

### Naming

- **Components:** PascalCase (`PhotoCard`, `SessionKioskClient`)
- **Hooks:** `use` prefix (`useGalleryStore`, `useSessionTimer`)
- **Files:** PascalCase for components; camelCase for utils/hooks
- **User slug:** `name.trim().replace(/\s+/g, "_")` (e.g. `John Doe` → `John_Doe`)
- **Daily folders:** `DD-MM-YYYY` under `BASE_DIR`

### UI

- **studio-kiosk:** Tailwind CSS 4 + shadcn/ui (New York) + Radix + Lucide icons
- **kiosk-app:** Utility classes + custom CSS (`screen--idle`, etc.)
- **Styling helper:** `cn(clsx + tailwind-merge)` everywhere
- **Variants:** `class-variance-authority` for `Button`
- **Copy:** Indonesian for user-facing strings (`Registrasi`, `Terima kasih`, etc.)
- **Client components:** `"use client"` on interactive Next.js components

### Paths & imports

- **studio-kiosk:** `@/*` alias → project root (`tsconfig.json`)
- **kiosk-app:** Relative imports from `renderer/`

### API integration

- Use `fetch` with JSON; no React Query/SWR
- Base URL: `NEXT_PUBLIC_API_URL` (studio-kiosk) or `getApiBase()` (kiosk-app)
- Image lists: `cache: "no-store"` in gallery service
- Print payload: base64 PNG array; body limit 50mb on api

### State

- **Gallery/print:** Zustand `useGalleryStore` — do not duplicate selection state locally
- **Session screens:** `useSessionTimer` hook (operator + kiosk); capture countdown still uses `useRef` interval
- **Canvas interaction:** `useCanvasPanZoomPro` for pan/zoom on print canvas

### Comments

- Mix of Indonesian and English; prefer English for new shared modules
- Avoid debug `console.log` in committed code

### What to avoid

- Inline `fetch` for endpoints already in `image.service.ts` — extend the service instead
- Editing `renderer.js` or `bundle.js` — legacy/build artifacts
- Hardcoding API URLs outside `lib/env.ts` / `config.js`

---

## Development Workflow

### Prerequisites

- Node.js (LTS recommended)
- npm
- Windows studio machine for full print/capture path (macOS can run api + frontends with path overrides)
- Optional: Sony camera + Imaging Edge, HDMI capture card, SumatraPDF (Windows print)

### Install

From each app directory:

```bash
cd api && npm install
cd ../studio-kiosk && npm install
cd ../kiosk-app && npm install
```

### Environment

| Variable | App | Purpose |
|----------|-----|---------|
| `PORT` | api | Server port (default `4000`) |
| `SESSION_DURATION_MINUTES` | api | Default session length |
| `CAPTURE_COUNTDOWN_SECONDS` | api | Shutter countdown |
| `CAMERA_CAPTURE_COMMAND` | api | Shell command to trigger camera |
| `NEXT_PUBLIC_API_URL` | studio-kiosk | API base URL |
| `window.__KIOSK_CONFIG__.apiBase` | kiosk-app | Runtime API override in Electron |

**Filesystem:** Edit `BASE_DIR` in `api/server.js` for your machine (default `D:\SudutPandangStudio`).

### Run locally

Use **three terminals**:

```bash
# Terminal 1 — API
cd api
node server.js
# → http://localhost:4000

# Terminal 2 — Operator UI
cd studio-kiosk
npm run dev
# → http://localhost:5173

# Terminal 3 — Customer kiosk (Electron + Vite)
cd kiosk-app
npm run dev
# Vite → http://localhost:5180, Electron loads second display fullscreen
```

### Typical dev loop

1. Start **api** first (session state + static images + Socket.IO).
2. Start **studio-kiosk** for operator flows.
3. Start **kiosk-app** on the customer display machine.
4. Register via `/session` or home → **Start Trial** / **Mulai Sesi Utama**.
5. Drop test images into `capture/` or use configured `CAMERA_CAPTURE_COMMAND`.
6. Access gallery: `/gallery?user=<slug>` or home → Access Photo.
7. Select photos → **Lanjut Cetak** → `/print` → **Print**.

### Build

```bash
cd studio-kiosk && npm run build && npm start
cd kiosk-app && npm run build   # Vite renderer; Electron main is copied manually
```

> **Note:** `kiosk-app/src/main.js` currently loads `http://localhost:5180` (dev). Production Electron packaging needs a file/URL load strategy.

### Lint

```bash
cd studio-kiosk && npm run lint
```

No lint/test setup in `kiosk-app` or `api`.

### Git

`.gitignore` currently only excludes `node_modules`. Consider also ignoring `.next/`, `dist/`, and `bundle.js` before committing.

### Critical files (read first)

| Priority | File | Why |
|----------|------|-----|
| 1 | `api/server.js` | System hub |
| 2 | `studio-kiosk/components/kiosk/SessionKioskClient.tsx` | Operator flow |
| 3 | `kiosk-app/src/renderer/App.jsx` | Customer kiosk |
| 4 | `studio-kiosk/stores/useGalleryStore.ts` | Gallery/print state |
| 5 | `studio-kiosk/components/print/PrintCanvas.tsx` | Print pipeline |

### Known gaps

- No monorepo workspace tooling (root `package.json` is empty)
- API client logic duplicated across files
- `sessionDurationMinutes` vs `sessionDurationSeconds` mismatch in kiosk config mapping
- Pause/resume/add-time APIs exist but lack full UI
- `new-photo` Socket event not consumed by frontends
- No automated tests

---

## Repository Structure

```
sudutpandang/
├── api/
│   └── server.js              # Backend monolith
├── studio-kiosk/
│   ├── app/                   # Next.js routes
│   ├── components/            # UI + kiosk + print
│   ├── stores/                # Zustand
│   ├── services/              # API wrappers
│   ├── lib/                   # env, templates, utils
│   └── utils/                 # canvas, export, face detect
├── kiosk-app/
│   └── src/
│       ├── main.js            # Electron main
│       ├── preload.js         # IPC bridge
│       └── renderer/          # React UI + hooks + services
├── .gitignore
├── README.md
└── PROJECT_GUIDE.md           # This file
```

---

*Last updated: project analysis — adjust paths and env vars for your studio machine.*
