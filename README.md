# Omni Patient Welcome Screen

A multi-tenant lobby/front-desk welcome screen for dental practices. One Vercel
deployment serves every office. Each office has its **own URL** and sees **only
its own data**.

## How it works
- Each office opens its own path URL: `https://welcome.omnidentalservice.com/inspire`
- `index.html` reads the office slug from the URL path and calls `/api/schedule`.
- `/api/schedule` (Vercel function) looks up the office, pulls **that office's**
  schedule from Kolla (scoped to that office's connection), and returns only
  `first_name`, `start`, `provider`, plus the office's branding.
- The screen shows today's patients grouped by hour. Staff tap a patient → a
  full-screen welcome appears (name editable; "Add walk-in" for unscheduled).

## Structure
```
.
├─ index.html              # the screen (UI; office comes from the URL path)
├─ offices.js              # OFFICE DIRECTORY — single source of truth (one row per office)
├─ vercel.json             # rewrites every non-/api path to index.html (pretty URLs)
├─ package.json            # type:module + npm scripts (dev, test, add-office, ...)
├─ .env.example            # copy to .env.local and paste your key (gitignored)
├─ api/
│  └─ schedule.js          # the ONLY place that decides which office sees what
├─ lib/
│  ├─ colors.js            # hex helpers (derive accent shades) — unit tested
│  └─ offices.js           # office validation + slug rules — unit tested
├─ scripts/
│  ├─ dev-server.js        # offline local preview (no Vercel login)
│  ├─ pull.js              # print one office's roster from the CLI
│  ├─ add-office.js        # one-command client onboarding
│  └─ _env.js              # loads .env.local for local tooling only
├─ test/                   # node --test suite (handler, colors, directory)
└─ .github/workflows/ci.yml
```

## Secrets
All secrets come from **environment variables** — nothing is ever committed and
the key never reaches the browser (it's used only server-side in `api/schedule.js`).
- `KOLLA_API_KEY` — your Kolla Unify API key (bearer)

- **Local:** put it in `.env.local` (gitignored). Start from the template:
  `cp .env.example .env.local`, then paste your key after `KOLLA_API_KEY=`.
- **Production:** set the same variable in Vercel: `vercel env add KOLLA_API_KEY`
  (add it to Production and Preview). Never put it in any committed file.

## Local development & testing
No Vercel login needed — a tiny local server mimics `vercel.json` (every non-`/api`
path serves `index.html`; `/api/schedule` runs the real function).

```
npm run dev                 # http://localhost:3000/inspire  (+ /winder, /lamirada)
npm run dev:mock            # force fake data even if a key is set
npm run pull -- inspire     # print one office's roster in the terminal
```

- **No key in `.env.local`** → **mock mode**: a deterministic, PHI-free fake
  roster per office, so you can see branding/layout without Kolla.
- **Key in `.env.local`** → **live mode**: pulls real appointments from Kolla.
- Every API response carries `X-Data-Source: mock | kolla` so the mode is obvious.

## Tests
Zero-dependency suite on Node's built-in runner:
```
npm test            # run once
npm run test:watch  # re-run on change
npm run check       # syntax-check the function + directory
```
Covers: unknown office → 404, mock branding/roster, **PII isolation** (only
`first_name`/`start`/`provider` ever returned), cancelled-appointment filtering,
time sorting, provider-alias mapping, the 502 degrade path, color derivation, and
that every office row in `offices.js` is valid. CI runs these on every push/PR
(`.github/workflows/ci.yml`).

## Office directory & per-office customization
Every office is one row in `offices.js`, keyed by its URL slug:

```js
"winder": {
  kollaConnector: "con_type_123",         // Kolla connector-id (integration / PMS type)
  kollaConsumer: "con_winder_123",        // Kolla consumer-id (this practice)
  passcode: "7390",                       // only used if REQUIRE_PASSCODE is on
  providers: ["Dr. Patel", "Dr. Romero"], // configurable doctors (shown in mock,
                                          // offered as walk-in suggestions)
  providerAliases: {                      // optional: clean up live Kolla names
    "PATEL, A DDS": "Dr. Patel"
  },
  branding: {                             // fully custom color scheme + identity
    name: "Winder Dental Care", sub: "Family & Cosmetic", logo: null,
    accent: "#e0a64f", accentDeep: "#c98a32", accentSoft: "#f0c987",
    welcomeMsg: "Welcome back — we're delighted to see you today."
  }
}
```

- **Separate URL per office:** the slug is the path (`/winder`). Two offices can
  never share a URL, and `api/schedule.js` returns 404 for unknown slugs.
- **Custom colors:** `accent` / `accentDeep` / `accentSoft` theme the whole screen.
- **Configurable doctors:** `providers` is the office's doctor list; `providerAliases`
  maps raw Kolla provider names to friendly display names in live mode.

### Onboard a client in one command
```
npm run add-office -- --slug winder --connector con_type_123 --consumer con_winder_123 \
  --name "Winder Dental Care" --sub "Family & Cosmetic" \
  --accent "#e0a64f" --providers "Dr. Patel, Dr. Romero"
```
Validates the row, derives the accent shades from a single color, writes it to
`offices.js`, and prints the office's local + production URLs and kiosk command.
Use `--force` to overwrite. Migrate `offices.js` to Vercel KV once you have many
offices (see the TODO at the top of the file) so onboarding becomes a row insert.

## Deploy
```
vercel            # link + preview
vercel --prod     # production
```
Then add the domain `welcome.omnidentalservice.com` in the Vercel dashboard.

## Per-office screen
Open the office URL in Chrome kiosk mode, e.g.:
```
chrome --kiosk "https://welcome.omnidentalservice.com/inspire"
```
