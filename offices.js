// ─── OFFICE DIRECTORY (single source of truth) ───────────────────────────────
// One row per office, keyed by URL slug. The slug IS the URL path
// (/inspire-dental-tigard, ...), so the URL alone selects the office. Each row:
//   • kollaConnector   — Kolla connector-id (which integration / PMS type)
//   • kollaConsumer    — Kolla consumer-id (which specific practice connection)
//                        Together these two headers scope the call to ONE office.
//   • timezone         — IANA tz (e.g. "America/Chicago"). "Today" is computed in
//                        THIS zone so each office fetches only its own local day.
//   • passcode         — only used if REQUIRE_PASSCODE is on in api/schedule.js
//   • providers        — the office's doctors (configurable). Shown in mock mode
//                        and offered as suggestions for walk-ins.
//   • providerAliases  — optional { rawKollaName: "Friendly Name" } to clean up
//                        how live Kolla provider names are displayed.
//   • branding         — name, sub, logo URL or null, accent colors, welcomeMsg.
//
// ⚠️  PLACEHOLDERS TO REPLACE before going live (search "REPLACE"):
//     • every kollaConnector + kollaConsumer  → your real Kolla connector/consumer IDs
//     • providers[]                           → each office's real doctors
//
// Onboard another client in one command (keeps this file consistent + prints URLs):
//   npm run add-office -- --slug fresh-smile-dental \
//     --connector con_type_xxx --consumer con_xxx \
//     --name "Fresh Smile Dental" --accent "#e8806e" --providers "Dr. Bennett, Dr. Ortiz"
//
// TODO(migrate to Vercel KV): when you have many offices, move these rows into
// Vercel KV so onboarding a client is a row insert with no redeploy. Replace the
// OFFICES[name] lookup in api/schedule.js with `await kv.get('office:' + name)`.
//
// NOTE: the onboarding script rewrites everything below this comment block. Keep
// hand edits above this line, or just use `npm run add-office`.
export const OFFICES = {
  "inspire-dental-tigard": {
    "kollaConnector": "con_inspire_CONNECTOR_REPLACE",
    "kollaConsumer": "con_inspire_CONSUMER_REPLACE",
    "timezone": "America/Los_Angeles",
    "passcode": "4821",
    "providers": [
      "Dr. Choi",
    ],
    "providerAliases": {},
    "branding": {
      "name": "Inspire Dental",
      "sub": "Tigard, Oregon",
      "logo": null,
      "accent": "#3fa08c",
      "accentDeep": "#2f7e6e",
      "accentSoft": "#8fcabd",
      "welcomeMsg": "We're so glad you're here. Relax — you're in good hands."
    }
  },
  "la-mirada-one-dental": {
    "kollaConnector": "con_lamirada_CONNECTOR_REPLACE",
    "kollaConsumer": "con_lamirada_CONSUMER_REPLACE",
    "timezone": "America/Los_Angeles",
    "passcode": "5126",
    "providers": [
      "Dr. Park"
    ],
    "providerAliases": {
      "DR. J. ALVAREZ": "Dr. Alvarez",
      "KIM, SUSAN DDS": "Dr. Kim"
    },
    "branding": {
      "name": "La Mirada One Dental",
      "sub": "La Mirada, California",
      "logo": null,
      "accent": "#5a8dd6",
      "accentDeep": "#3f6fb5",
      "accentSoft": "#a8c4ec",
      "welcomeMsg": "Welcome in — we're happy to see you today."
    }
  },
  "laguna-summit-dental": {
    "kollaConnector": "opendental",
    "kollaConsumer": "Laguna Summit Dental",
    "timezone": "America/Los_Angeles",
    "passcode": "6701",
    "providers": [
      "Dr. Koh",
      "Dr. Park"
    ],
    "providerAliases": {},
    "branding": {
      "name": "Laguna Summit Dental",
      "sub": "Laguna Hills, California",
      "logo": null,
      "accent": "#5aa17a",
      "accentDeep": "#3f8060",
      "accentSoft": "#a6d2ba",
      "welcomeMsg": "Welcome — we're delighted to care for you today."
    }
  },
  "fresh-smile-dental": {
    "kollaConnector": "opendental",
    "kollaConsumer": "Fresh Smile Dental Care",
    "timezone": "America/Chicago",
    "passcode": "3398",
    "providers": [
      "Dr. Yeo"
    ],
    "providerAliases": {},
    "branding": {
      "name": "Fresh Smile Dental",
      "sub": "Dallas, Texas",
      "logo": null,
      "accent": "#e8806e",
      "accentDeep": "#cf6553",
      "accentSoft": "#f3b3a6",
      "welcomeMsg": "Welcome — we're so happy to see your smile."
    }
  },
  "line-dental": {
    "kollaConnector": "eaglesoft",
    "kollaConsumer": "Line Dental Aloha",
    "timezone": "America/Los_Angeles",
    "passcode": "8042",
    "providers": [
      "Dr. Choi"
    ],
    "providerAliases": {},
    "branding": {
      "name": "Line Dental",
      "sub": "Aloha, OR",
      "logo": null,
      "accent": "#6a6fd0",
      "accentDeep": "#5054b0",
      "accentSoft": "#b3b6ea",
      "welcomeMsg": "Welcome in — we're glad you're here today."
    }
  }
};