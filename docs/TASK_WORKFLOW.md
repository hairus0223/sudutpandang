# Sudut Pandang — Task Workflow

Step-by-step process for working on any feature, fix, or refactor in this repo.

**Read first:** [PROJECT_GUIDE.md](./PROJECT_GUIDE.md) — architecture, feature map, reusables, conventions, and dev setup.

**Golden rules:**

1. Reuse existing components.
2. Reuse existing services.
3. Follow the current architecture (api ↔ studio-kiosk ↔ kiosk-app).
4. Write and agree on an implementation plan **before** coding.

---

## Table of Contents

1. [How to Analyze a Feature](#1-how-to-analyze-a-feature)
2. [How to Find Reusable Code](#2-how-to-find-reusable-code)
3. [How to Create an Implementation Plan](#3-how-to-create-an-implementation-plan)
4. [How to Implement Safely](#4-how-to-implement-safely)
5. [How to Review Code](#5-how-to-review-code)
6. [How to Generate Test Cases](#6-how-to-generate-test-cases)

---

## 1. How to Analyze a Feature

### 1.1 Clarify the request

Answer these before touching code:

| Question | Example |
|----------|---------|
| What is the user-facing outcome? | "Gallery refreshes when a new photo arrives" |
| Who is the actor? | Operator (`studio-kiosk`), customer (`kiosk-app`), or backend only |
| Which app(s) are affected? | `api`, `studio-kiosk`, `kiosk-app`, or combination |
| Is this new behavior or a fix? | Fix config timer bug vs. new package type |
| What is explicitly out of scope? | "No database", "no auth" unless requested |

### 1.2 Map to the feature map

Open [PROJECT_GUIDE.md — Feature Map](./PROJECT_GUIDE.md#feature-map) and locate:

- **Route(s)** — `/`, `/session`, `/gallery?user=`, `/print`, or kiosk screen states
- **Existing components** already involved
- **API endpoints** already used or needed
- **Socket.IO events** if realtime sync is required

### 1.3 Trace the data flow

Draw the path end-to-end:

```text
User action → UI component → service/store → API/Socket → filesystem → response → UI update
```

For Sudut Pandang, common patterns:

| Pattern | Flow |
|---------|------|
| **Operator control** | `SessionKioskClient` → `POST /api/kiosk/*` → Socket.IO → `kiosk-app/App.jsx` |
| **Capture** | Shutter trigger → `capture/` folder → chokidar → user folder → `GET /api/images/:user` |
| **Gallery → print** | `GalleryClient` → `useGalleryStore` → `/print` → `exportCanvasPrint` → `POST /api/print` |

### 1.4 Identify dependencies and constraints

Check against [PROJECT_GUIDE.md — Architecture](./PROJECT_GUIDE.md#architecture):

- Windows paths (`BASE_DIR`, SumatraPDF)
- In-memory session (single API instance, lost on restart)
- No auth (LAN-trusted)
- Duplicated API clients across files
- Legacy code (`kiosk-app/renderer.js`, `bundle.js`) — do not extend

### 1.5 Document gaps

List what does **not** exist yet:

- Missing API endpoint vs. missing UI vs. missing Socket listener
- Type mismatches (e.g. `sessionDurationMinutes` vs `sessionDurationSeconds`)
- Endpoints with no consumer (`new-photo`, pause/resume)

**Deliverable:** A short **Feature Analysis** note (bullet list) with actor, apps, routes, endpoints, and data flow.

---

## 2. How to Find Reusable Code

### 2.1 Search order

Search in this order — prefer reuse over creation:

```text
1. PROJECT_GUIDE.md (Reusable Components / Services)
2. studio-kiosk/components/
3. studio-kiosk/stores/ and services/
4. studio-kiosk/utils/ and lib/
5. kiosk-app/src/renderer/ (hooks, services, components)
6. api/server.js (existing endpoints and helpers)
```

### 2.2 Component reuse checklist

| Need | Look here first |
|------|-----------------|
| Button, input, dialog | `studio-kiosk/components/ui/` |
| Photo grid / tile | `PhotoCard` |
| Gallery lightbox | `PhotoModal` |
| Print selection footer | `BottomPrintBar` |
| Registration / access | `RegisterForm`, `AccessForm` |
| Print editor | `PrintCanvas`, `PrintToolbar`, `TemplateSelector` |
| Session operator UI | `SessionKioskClient` (extend, don't duplicate) |
| Customer kiosk screens | `kiosk-app/App.jsx` + hooks |
| Timer / camera / audio | `useSessionTimer`, `useCameraPreview`, `useKioskAudio` |

### 2.3 Service reuse checklist

| Need | Look here first |
|------|-----------------|
| Load user images | `services/image.service.ts` → `fetchImages` |
| Gallery/print state | `stores/useGalleryStore.ts` |
| API base URL (Next.js) | `lib/env.ts` |
| API base URL (Electron) | `kiosk-app/config.js` → `getApiBase` |
| Kiosk capture / latest image | `kiosk-app/services/api.js` |
| Print export | `utils/exportCanvas.ts` |
| Canvas layout / filters | `components/print/canvas/*`, `utils/canvasFilters.ts` |

### 2.4 Model / type reuse

| Type | Source |
|------|--------|
| `ImageData` | `stores/useGalleryStore.ts` |
| `PhotoTransform`, `PhotoFilter` | `stores/useGalleryStore.ts` |
| `PrintTemplate` | `lib/printTemplates.ts` |
| `FaceBox` | `utils/faceDetect.ts` |
| `Customer`, `Session`, `PackageType` | Inline in `SessionKioskClient.tsx` (formalize if shared) |

### 2.5 When reuse is not enough

Create new code only if:

- No existing component fits **and** composing existing ones is awkward
- No service covers the endpoint **and** extending `image.service.ts` or `api.js` is the right home
- New code belongs in the **same layer** as similar code (don't put API logic in a UI component)

Prefer **extending** a service file over **inline `fetch`** in a component.

### 2.6 Cross-app duplication

If the same logic exists in `studio-kiosk` and `kiosk-app` (e.g. `msToMMSS`, register API), note it in the plan. Do not add a third copy — extend one place or plan a shared module for later.

**Deliverable:** A **Reuse Map** table: `Need → Existing file → Action (use / extend / new)`.

---

## 3. How to Create an Implementation Plan

Do not write code until the plan is written and reviewed.

### 3.1 Plan template

```markdown
## [Task title]

### Goal
One sentence: what changes for the user or system.

### Scope
- In scope: ...
- Out of scope: ...

### Affected apps
- [ ] api
- [ ] studio-kiosk
- [ ] kiosk-app

### Reuse map
| Need | Reuse | Action |
|------|-------|--------|
| ... | `path/to/file` | use / extend |

### Files to change (minimal)
1. `path/to/file` — reason
2. ...

### API / Socket changes
- New or modified endpoints:
- Socket events:

### Data / state changes
- Store fields, `customer.json`, session shape, etc.

### Implementation steps (ordered)
1. ...
2. ...

### Risks
- ...

### Manual test plan
- [ ] ...

### Rollback
How to revert safely if something breaks.
```

### 3.2 Size the change

| Size | Guideline |
|------|-----------|
| **Small** | 1–2 files, one app, no API change |
| **Medium** | Multiple files, one app, or API + one frontend |
| **Large** | Cross-app + new endpoints + Socket events — split into phases |

Large tasks: ship **backend first**, then **operator UI**, then **kiosk-app**.

### 3.3 Architecture alignment check

Before approving the plan, confirm:

- [ ] Operator actions go through `api`, not direct kiosk-to-kiosk
- [ ] Customer display still listens via Socket.IO for session control
- [ ] Photos still flow through filesystem + `/api/images/:user`
- [ ] Print still uses canvas export → `POST /api/print` unless explicitly redesigning
- [ ] No new database or auth unless explicitly requested
- [ ] Config uses `lib/env.ts` / `config.js`, not hardcoded URLs

### 3.4 Get approval

- Share the plan in the issue, PR description, or chat.
- Wait for explicit **go ahead** before coding.
- If scope shifts mid-work, update the plan first.

**Deliverable:** Completed plan from the template above.

---

## 4. How to Implement Safely

### 4.1 Pre-implementation

- [ ] Plan approved
- [ ] Correct branch checked out
- [ ] All three apps' dev setup understood ([Development Workflow](./PROJECT_GUIDE.md#development-workflow))
- [ ] `BASE_DIR` / `NEXT_PUBLIC_API_URL` correct for your machine

### 4.2 Implementation order

```text
1. api/server.js        (endpoints, watchers, Socket emits)
2. Shared types/services (extend image.service, api.js — if in scope)
3. studio-kiosk         (operator / gallery / print)
4. kiosk-app            (customer display — only if affected)
5. PROJECT_GUIDE.md     (only if feature map or architecture changed)
```

### 4.3 Safe coding practices

| Practice | Why |
|----------|-----|
| **Minimal diff** | Touch only files in the plan |
| **Extend, don't fork** | Add to `image.service.ts`, not new inline fetch |
| **Match conventions** | TS strict in studio-kiosk; `"use client"` where needed; Indonesian UI copy |
| **Preserve behavior** | Don't refactor unrelated code in the same PR |
| **Avoid legacy files** | Don't edit `renderer.js` or `bundle.js` |
| **Env-aware** | Paths and API URL via config, not literals |
| **Socket + REST together** | If API emits an event, wire the listener in the same task or document as follow-up |

### 4.4 Verify while building

After each logical step:

```bash
# api
cd api && node server.js

# studio-kiosk
cd studio-kiosk && npm run dev

# kiosk-app
cd kiosk-app && npm run dev
```

Run the **manual test plan** steps for the part you just changed.

### 4.5 Commit discipline

- One logical change per commit when possible
- Message: what + why (e.g. `fix: map kiosk-config sessionDurationMinutes in config.js`)
- Do not commit secrets, `.env`, or local path overrides

### 4.6 When to stop and replan

Stop and revise the plan if:

- You need a new app or database
- The change touches more than ~5 files unexpectedly
- Existing reuse map was wrong
- Breaking change to `customer.json` or session shape without migration

**Deliverable:** Working code on a branch, plan checklist ticked, manual tests run.

---

## 5. How to Review Code

### 5.1 Self-review checklist

Before opening a PR or marking done:

#### Architecture
- [ ] Changes sit in the correct app (`api` vs `studio-kiosk` vs `kiosk-app`)
- [ ] No bypass of API for cross-display sync
- [ ] Filesystem layout unchanged or documented

#### Reuse
- [ ] Existing components used where possible
- [ ] No duplicate `fetch` for endpoints already in a service
- [ ] `useGalleryStore` used for gallery/print state (not parallel local state)

#### Correctness
- [ ] Happy path works end-to-end
- [ ] Error states handled (network fail, 404 customer, empty gallery)
- [ ] Timers and Socket listeners cleaned up on unmount
- [ ] Active session required where API expects it (capture routing)

#### Conventions
- [ ] TypeScript types for new studio-kiosk code
- [ ] `cn()` for class merging
- [ ] No debug `console.log` left in
- [ ] Indonesian strings for user-facing text

#### Safety
- [ ] No hardcoded `192.168.x.x` outside env/config
- [ ] No Windows-only paths in frontend code
- [ ] Large payloads (print) still within API body limits

### 5.2 Peer review focus areas

Ask reviewers to check:

1. **Does this match the approved plan?**
2. **Could an existing component/service do this?**
3. **What happens when api restarts mid-session?**
4. **What happens with no photos / no active session?**

### 5.3 Regression surfaces

High-risk areas — always smoke-test:

| Area | Quick check |
|------|-------------|
| Registration | `POST /api/register` creates folder + `customer.json` |
| Session sync | Trial/main buttons update kiosk display |
| Capture routing | File in `capture/` lands in active user folder |
| Gallery | `/gallery?user=<slug>` loads images |
| Print | Select → `/print` → Print → PDF/printer |
| Config | Kiosk timer matches `GET /api/kiosk-config` |

### 5.4 Documentation

Update [PROJECT_GUIDE.md](./PROJECT_GUIDE.md) when you:

- Add a route or major feature
- Add or change API endpoints / Socket events
- Introduce a new reusable service or component pattern

**Deliverable:** Review checklist completed; PR description links to plan and test results.

---

## 6. How to Generate Test Cases

There is no automated test suite today. Use **structured manual test cases** and add automation only when explicitly requested.

### 6.1 Test case template

```markdown
### TC-[ID]: [Short title]
- **Feature:** (from feature map)
- **App(s):** api | studio-kiosk | kiosk-app
- **Preconditions:** e.g. api running, active session for user `Test_User`
- **Steps:**
  1. ...
  2. ...
- **Expected result:** ...
- **Priority:** P0 (blocker) | P1 (important) | P2 (nice)
```

### 6.2 Generate cases from the feature map

For each affected feature row in PROJECT_GUIDE, create at least:

| Case type | Purpose |
|-----------|---------|
| **Happy path** | Main flow works |
| **Empty state** | No data, no session, no images |
| **Invalid input** | Missing name, wrong user slug, over print limit |
| **Boundary** | Session timer at 0, max `peopleCount`, max selected prints |
| **Failure** | API down, capture folder locked, print command fails |
| **Cross-app** | Operator action visible on kiosk within expected time |

### 6.3 Test cases by layer

#### API (`api/server.js`)

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| TC-API-01 | Register valid customer | `POST /api/register` with name, peopleCount | 200, folder + `customer.json` created |
| TC-API-02 | Register missing name | `POST /api/register` without name | 400 |
| TC-API-03 | Images for unknown user | `GET /api/images/unknown` | `{ images: [] }` |
| TC-API-04 | Capture routing | Active session + drop JPG in `capture/` | File moved to user folder, `new-photo` emitted |
| TC-API-05 | Capture without session | Drop JPG, no active session | File ignored in user folder |
| TC-API-06 | Kiosk trial start | `POST /api/kiosk/trial-start` | Socket clients receive event |
| TC-API-07 | Print empty | `POST /api/print` with `[]` | 400 |

#### studio-kiosk

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| TC-SK-01 | Home headline load | Open `/` | Headline grid populates or empty gracefully |
| TC-SK-02 | Access gallery | Access Photo → enter slug → submit | Navigates to `/gallery?user=` |
| TC-SK-03 | Register on home | Register form submit | Success message; folder created |
| TC-SK-04 | Session register + trial | `/session` → register → Start Trial | Timer runs; kiosk shows trial (if connected) |
| TC-SK-05 | Print limit | Select more than `allowedPrint` | Alert / blocked |
| TC-SK-06 | Print flow | Select photos → Lanjut Cetak → Print | API called; selection reset |

#### kiosk-app

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| TC-KA-01 | Idle screen | Launch app, no session | Idle message shown |
| TC-KA-02 | Main session sync | Operator starts main session | Main screen, preview starts, timer runs |
| TC-KA-03 | Session end | Operator ends session | End screen, preview stops |
| TC-KA-04 | Capture countdown | During main session (if capture enabled) | Countdown → shutter sound → latest image |
| TC-KA-05 | Pas-photo frame | `packageType: pas-photo` | Frame overlay on live preview |

### 6.4 End-to-end scenarios (P0)

Run these for every release-worthy change:

```markdown
### E2E-01: Full studio session
1. Start api, studio-kiosk, kiosk-app
2. `/session` → register new customer (self-photo)
3. Start Trial → verify kiosk trial screen
4. Skip Trial → Start Main → verify kiosk main screen
5. Drop test image in capture/ (or trigger capture)
6. `/gallery?user=<slug>` → photo appears
7. Select photos → print → verify print API success
8. End session → kiosk end screen

### E2E-02: Returning customer
1. Register same name earlier today
2. `/session` → Cek by Name → resume
3. Gallery still shows prior photos

### E2E-03: API restart mid-session
1. Start session
2. Restart api
3. Document actual behavior (session lost — known limitation)
```

### 6.5 Map test cases to the plan

In the implementation plan, copy relevant TC-/E2E- IDs into **Manual test plan**. Add new IDs for feature-specific behavior.

### 6.6 Future automation (optional)

If adding tests later, prioritize:

1. **api** — supertest on `/api/register`, `/api/images/:user`, session endpoints
2. **studio-kiosk** — Playwright for `/gallery` and `/print` flows
3. **utils** — unit tests for `printChunk`, `getCanvasFilter`, `msToMMSS`

**Deliverable:** Test case list attached to PR; P0 cases executed and results noted.

---

## Quick Reference

```text
Analyze  → Feature map + data flow + gaps
Reuse    → PROJECT_GUIDE + components/ + services/ + stores/
Plan     → Template + approval BEFORE code
Implement→ api → services → studio-kiosk → kiosk-app → verify
Review   → Architecture + reuse + regression smoke tests
Test     → TC template + feature-map-derived cases + E2E-01/02/03
```

---

*Companion doc: [PROJECT_GUIDE.md](./PROJECT_GUIDE.md)*
