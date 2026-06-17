# Rise Above App — Build Spec

## Project goal
Rebuild the existing **sd118-runlog.vercel.app** with feature parity for the Running Log, **plus** add a main menu, **plus** add a complete ISM Logs section with all 22 SMS forms. Deploy as a Vercel preview on the existing project (`prj_KVjPOPbaJa9n4VY4k75vkEzIr6Wz`, scope `gabriel-garcez-s-projects`). Do NOT touch the production deployment until user approves.

## Vessel
- Name: **Rise Above** (rename anything that says "SD118" or "Rise Above III" to just "Rise Above")
- Type: M/Y (motor yacht)
- App title: **"Rise Above Engine Log"** (replaces "SD118 Engine Log")

## Tech stack (match existing exactly)
- **Vite + React + TypeScript**
- **Tailwind CSS** with shadcn/ui-style components (Card, Button, Input, Label, Checkbox, Textarea)
- **wouter** for hash-based routing (existing app uses this)
- **@tanstack/react-query** for API calls
- **Dark theme**, HSL CSS variables, **red-600 (#dc2626) primary accent** (matches existing)
- API routes as **Vercel serverless functions** in `/api/*.ts`

## Theme tokens (extracted from live app)
```css
:root {
  --background: 0 0% 7%;        /* ~#121212 */
  --foreground: 0 0% 98%;
  --card: 0 0% 10%;
  --card-foreground: 0 0% 98%;
  --primary: 0 72% 51%;         /* red-600 */
  --primary-foreground: 0 0% 98%;
  --secondary: 0 0% 14%;
  --muted: 0 0% 14%;
  --muted-foreground: 0 0% 60%;
  --border: 0 0% 18%;
  --input: 0 0% 14%;
  --ring: 0 72% 51%;
  --destructive: 0 72% 51%;
  --radius: 0.5rem;
}
```

## Existing API contract (preserve exactly)
Routes the existing client expects on the same domain:
- `POST /api/auth` → body `{code: string}` → returns `{token: string}` (HMAC-signed)
- `POST /api/extract` → multipart with image files OR JSON `{images: [base64...]}` → returns extracted engine/nav/tank values keyed by section
- `POST /api/write-row` → body `{values: {...}, token}` → writes to Google Sheet `1AwP7GZFaYIhQl0Qyy-3045do3W4_bhC1Lk0j1DDujik`

**These env vars are already configured on the production Vercel project (we have not changed them):**
- `ACCESS_CODE` — the login code
- `ANTHROPIC_API_KEY` — Claude vision
- `HMAC_SECRET` — token signing
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_SHEET_ID`

If different names are in production, do not change them in code — instead detect via `process.env` and accept multiple common names (`ACCESS_CODE` || `LOGIN_CODE` || `AUTH_CODE`). Same for Sheet ID: `GOOGLE_SHEET_ID` || `SHEET_ID`. For Anthropic: `ANTHROPIC_API_KEY`.

Use `npx vercel env ls` (with `--token $VERCEL_TOKEN --scope gabriel-garcez-s-projects`) to list which env var names actually exist. Match those exact names.

## Existing Running Log — fields to preserve (extracted from live bundle)
The review form must show these sections and fields exactly. Don't lose or rename any.

### Section: Date/Time
- `date` — Date
- `time` — Time

### Section: Position & Navigation
- `hdg` — HDG [°M]
- `cog` — COG [°M]
- `sog` — SOG [kn]
- `position` — Position
- `eta` — ETA
- `dta` — DTA [NM]
- `depth` — Depth [m]

### Section: Port Engine
- `port_rpm` — RPM
- `port_coolant_temp` — Coolant Temp [°C]
- `port_oil_temp` — Oil Temp [°C]
- `port_oil_press` — Oil Pressure [kPa]
- `port_trans_oil_temp` — Trans Oil Temp [°C]
- `port_trans_oil_press` — Trans Oil Press [kPa]
- `port_fuel_rate` — Fuel Rate [L/h]
- `port_fuel_temp` — Fuel Temp [°C]
- `port_exhaust_temp_l` — Exhaust Temp Left [°C]
- `port_exhaust_temp_r` — Exhaust Temp Right [°C]
- `port_engine_load` — Engine Load [%]
- `port_battery_voltage` — Battery Voltage [V]
- `port_engine_hours` — Engine Hours [hrs]
- `port_coolant_level` — Coolant Level

### Section: Starboard Engine (same fields as Port, `stbd_*` prefix)

### Section: Tanks
- `daily_fuel` — Daily Fuel [L]
- `aft_main_fuel` — Aft Main Fuel [L]
- `fwd_main_fuel` — Fwd Main Fuel [L]
- `black_grey_water` — Black/Grey Water [L]
- `fresh_water` — Fresh Water [L]
- `sludge` — Sludge [L]

### Section: Generators (if applicable — keep what's there)
- `gen1_hours`, `gen2_hours`, etc.

### Section: Other / Notes
- `notes` — Notes (textarea)

## New: Main menu (after login)
Route: `/menu` (default landing after `/api/auth` success)

```
┌────────────────────────────────────┐
│         RISE ABOVE                 │
│       Engine Log & SMS             │
├────────────────────────────────────┤
│                                    │
│  [📋  Running Log              ›]  │
│                                    │
│  [🛡️  ISM Logs                 ›]  │
│                                    │
│  [⚙️  Settings                 ›]  │
│                                    │
├────────────────────────────────────┤
│ Signed in as: <Name>   [Log out]   │
└────────────────────────────────────┘
```

- Tap **Running Log** → `/runlog/upload` (existing flow, unchanged)
- Tap **ISM Logs** → `/ism` (new — see below)
- Tap **Settings** → `/settings` (just shows "Your name", lets user change it; "Log out" button)

## "Your name" field (persistent identity)
- On first login (post-access-code), if no name in `localStorage.crewName`, redirect to `/settings/name`
- Simple screen: "Your name" input + "Continue" button → saves to `localStorage.crewName`
- This name is used as the signer for every ISM form
- Can be changed in Settings

## New: ISM Logs section
Route tree:
- `/ism` — chooser screen, two big buttons:
  - **Operating Procedures** (10 forms)
  - **Emergency Procedures** (12 forms)
- `/ism/operating` — list of 10 procedures
- `/ism/emergency` — list of 12 procedures
- `/ism/form/:formId` — the actual form (wizard-style fill)
- `/ism/preview/:submissionId` — shows the data the user just submitted as a JSON/table preview ("PDF will be generated here in Phase 2")

## All 22 ISM forms — definitions

The forms come from M/Y RISE ABOVE III Safety Management System binder. Header on every form: "M/Y RISE ABOVE" (we drop the "III"). Two form types:

### Type A: Operating Procedure (10 forms)
Structure: header + checklist (each item is a checkbox) + signature line + date line.

### Type B: Emergency Procedure (12 forms)
Structure: header + (some show "SOUND EMERGENCY ALARM" banner in red) + **incident header table** (Yacht name / Call sign / Date of incident / Time / Location / Weather / Type of incident / Persons involved / Injuries sustained / Damage to vessel) + checklist + sometimes a "For Specific Incidents" sub-table with multiple columns/categories.

### Form catalog (use this exact structure in code as a TypeScript constant)

See `/home/user/workspace/sd118-runlog/forms-catalog.ts` (separate file).

## Form UX (mobile-first)
- Big checkboxes (44pt+ touch target)
- One section visible at a time on phone, smooth scroll
- Auto-fill where possible:
  - **Yacht name** → "Rise Above" (read-only)
  - **Call sign** → leave blank for now, user can type
  - **Date of incident / Date** → today's date by default, editable
  - **Time of incident / Time** → current time, editable
  - **Location** → empty, user types (later: GPS auto-fill)
  - **Weather** → empty, user types
  - **Signature line** → autofilled with `localStorage.crewName`
- Free-text input for incident details
- "Save" button at bottom → POST to `/api/ism/save` → redirect to `/ism/preview/:id` showing what was captured

## /api/ism/save (new endpoint)
- Accepts: `{formId, formName, formType, submittedAt, signerName, fields: {...}}`
- For now (Phase 1):
  1. Append a row to a new sheet tab called **`ISM_Log`** in the existing Google Sheet
     - Columns: Timestamp, Form Name, Form Type, Signer, Vessel, Fields_JSON (stringified)
     - Create the tab if it doesn't exist
  2. Return `{ok: true, id: <generated uuid>}`
- Phase 2 (later): generate PDF + upload to Google Drive

## File structure
```
sd118-runlog/
├── api/
│   ├── auth.ts
│   ├── extract.ts
│   ├── write-row.ts
│   └── ism/
│       └── save.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── utils.ts
│   ├── components/
│   │   ├── ui/ (Card, Button, Input, Label, Checkbox, Textarea)
│   │   ├── MenuLayout.tsx
│   │   ├── FormHeader.tsx
│   │   ├── OperatingProcedureForm.tsx
│   │   └── EmergencyProcedureForm.tsx
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Menu.tsx
│   │   ├── SetName.tsx
│   │   ├── Settings.tsx
│   │   ├── runlog/
│   │   │   ├── Upload.tsx
│   │   │   ├── Review.tsx
│   │   │   └── Success.tsx
│   │   └── ism/
│   │       ├── Index.tsx        (Operating | Emergency chooser)
│   │       ├── List.tsx         (list of forms for a category)
│   │       ├── Form.tsx         (renders OperatingProcedureForm or EmergencyProcedureForm based on formId)
│   │       └── Preview.tsx
│   ├── data/
│   │   └── forms-catalog.ts     (all 22 forms)
│   └── styles/
│       └── globals.css
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── package.json
└── vercel.json
```

## Routing (wouter, hash-based to match existing)
- `/` → Login (if not authed) else redirect to `/menu`
- `/menu` → Main menu
- `/settings` and `/settings/name`
- `/runlog/upload`, `/runlog/review`, `/runlog/success`
- `/ism`, `/ism/operating`, `/ism/emergency`
- `/ism/form/:formId`
- `/ism/preview/:id`

## Auth flow
- Existing `/api/auth` stays
- Token stored in localStorage as `authToken`
- On app load: if `authToken` valid → check `crewName` → if missing, redirect to `/settings/name`; else `/menu`

## Deployment
1. Run `npm install`, `npm run build` locally to ensure clean build
2. `npx vercel --token $VERCEL_TOKEN --scope gabriel-garcez-s-projects` (without `--prod`) creates a **preview deployment**
3. Production at sd118-runlog.vercel.app stays untouched
4. Capture the preview URL and report it back

## Critical do-nots
- **Do NOT** deploy to `--prod`
- **Do NOT** modify env vars on the Vercel project
- **Do NOT** drop or rename existing engine-log fields — feature parity is critical
- **Do NOT** invent fields; if uncertain about a field, leave a TODO comment and continue

## Definition of done (Phase 1)
- Preview URL deployed
- Login with existing access code works
- "Your name" prompt on first run
- Menu screen shows
- Tap Running Log → existing flow works end-to-end (upload → review → save to Sheet)
- Tap ISM Logs → see all 22 forms across 2 sub-menus
- Open each form → can check boxes, fill fields, sign with name
- Submit form → preview screen shows data + writes summary row to ISM_Log tab in Sheet
- Dark theme + red accents throughout
- Mobile-friendly (test in narrow viewport)