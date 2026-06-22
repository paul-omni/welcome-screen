// ───────────────────────────────────────────────────────────────────────────
// /api/schedule.js   —   Vercel serverless function
//
// The browser sends an office NAME (?office=inspire). This function looks that
// name up, fetches ONLY that office's schedule from Kolla (scoped to that
// office's own consumer), and returns its branding + a sanitized patient list.
//
// What keeps offices apart:
//   • Each office's data is pulled with THAT office's Kolla consumer scope, so
//     one office's credentials physically cannot read another office's PMS.
//   • Only first name + time + provider ever leave the server (minimum
//     necessary) — no last name, DOB, or contact details.
//   • The office name is readable, so the URL alone is not a secret. If you want
//     to stop someone from simply typing another office's name, turn on the
//     optional one-time passcode below (REQUIRE_PASSCODE). Each office sets a
//     short code once per screen; it's remembered on the device. This keeps the
//     URL simple AND keeps offices from viewing each other.
//
// Secrets live in Vercel env vars, never in the browser:
//   KOLLA_API_KEY  — your Kolla Unify API key (bearer)
// ───────────────────────────────────────────────────────────────────────────

const REQUIRE_PASSCODE = false;   // flip to true for office-to-office isolation

// The office directory now lives in its own file (single source of truth) so the
// onboarding script (`npm run add-office`) can edit it. Migrate this to Vercel KV
// later — see the TODO at the top of offices.js.
import { OFFICES } from "../offices.js";
import { zonedToday } from "../lib/time.js";

const KOLLA_BASE = "https://unify.kolla.dev/dental/v1";
// Fallback timezone for any office missing one (offices should set their own).
const DEFAULT_TZ = "America/Los_Angeles";

// PREVIEW/MOCK MODE: with no Kolla key configured, the function serves a
// deterministic, PHI-FREE fake roster per office so you can SEE every office's
// unique branding locally (and on a key-less preview deploy) before you have a
// real Kolla connection + BAA. The instant KOLLA_API_KEY is set, this turns off
// and only real Kolla data is used. Mock names are obviously fake (not patients).
// Set MOCK=1 to force mock even when a key is present. Evaluated per-request so
// local tooling can load .env.local before the first call.
function usingMock() {
  return process.env.MOCK === "1" || !process.env.KOLLA_API_KEY;
}

const MOCK_FIRST_NAMES = ["Sarah", "James", "Maria", "David", "Aisha", "Liam",
  "Emma", "Noah", "Olivia", "Ethan", "Sofia", "Mateo", "Grace", "Owen"];
const DEFAULT_PROVIDERS = ["Dr. Smith", "Dr. Lee"];

function mockAppointments(slug, office) {
  // Doctors come from the office config (configurable), not a hardcoded list.
  const providers = (office.providers && office.providers.length)
    ? office.providers : DEFAULT_PROVIDERS;
  // Seed a tiny PRNG from the slug so each office shows a stable, distinct roster.
  let seed = 7; for (const ch of slug) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  const count = 5 + Math.floor(rnd() * 5);   // 5–9 patients today
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = new Date();
    t.setHours(9 + Math.floor(rnd() * 8), [0, 15, 30, 45][Math.floor(rnd() * 4)], 0, 0);
    out.push({
      id: `mock_${slug}_${i}`,
      contact: { given_name: MOCK_FIRST_NAMES[Math.floor(rnd() * MOCK_FIRST_NAMES.length)] },
      start_time: t.toISOString(),
      provider: { display_name: providers[Math.floor(rnd() * providers.length)] },
      status: "confirmed",
    });
  }
  return out;
}

// Map a raw Kolla provider name to the office's preferred display name.
function displayProvider(office, raw) {
  const aliases = office.providerAliases || {};
  return aliases[raw] || raw || "";
}

// Kolla scopes every request to ONE office via these headers. Same set is used
// for appointments AND contact lookups so both stay inside the office's consumer.
function kollaHeaders(office) {
  return {
    Authorization: `Bearer ${process.env.KOLLA_API_KEY}`,
    // connector-id → which integration / PMS type
    // consumer-id  → which specific practice connection
    "connector-id": office.kollaConnector,
    "consumer-id": office.kollaConsumer,
  };
}

// The appointment payload only carries a lightweight contact (given_name /
// family_name) and a `contact_id`. `preferred_name` lives only on the FULL
// Contact, so we resolve it here. Cached briefly + keyed by consumer so we don't
// re-fetch the same patient repeatedly (and never cross office boundaries).
const CONTACT_TTL_MS = 5 * 60 * 1000;   // 5 min — names rarely change intra-day
const contactCache = new Map();         // `${consumer}::${contactId}` -> { value, expires }

function contactUrl(contactId) {
  // contact_id comes back as a resource name like "contacts/123" (casing varies).
  const id = String(contactId).replace(/^contacts\//i, "");
  return `${KOLLA_BASE}/contacts/${encodeURIComponent(id)}`;
}

async function fetchContact(office, contactId, slug) {
  const cacheKey = `${office.kollaConsumer}::${contactId}`;
  const cached = contactCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;

  try {
    const res = await fetch(contactUrl(contactId), { headers: kollaHeaders(office) });
    if (!res.ok) {
      console.error(`[kolla] ✗ contact lookup office=${slug} status=${res.status}`);
      return null;
    }
    const contact = await res.json();
    contactCache.set(cacheKey, { value: contact, expires: Date.now() + CONTACT_TTL_MS });
    return contact;
  } catch (err) {
    console.error(`[kolla] ✗ contact lookup office=${slug} error`);
    return null;
  }
}

// Resolve the unique set of contact_ids on today's appointments to their full
// contacts (deduped + parallel). Failures are non-fatal — we fall back to the
// appointment's embedded short contact for that patient.
async function resolveContacts(office, appts, slug) {
  const ids = [...new Set(appts.map(a => a.contact_id).filter(Boolean))];
  const map = new Map();
  await Promise.all(ids.map(async (id) => {
    const c = await fetchContact(office, id, slug);
    if (c) map.set(id, c);
  }));
  console.log(`[kolla] ✓ contacts resolved office=${slug} requested=${ids.length} resolved=${map.size}`);
  return map;
}

// ---- Pull today's appointments for ONE office, scoped to its consumer ---------
async function fetchTodaysAppointments(office, slug) {
  // Restrict the call to the office's LOCAL "today" — computed in its own
  // timezone so a Dallas (Central) office and a California (Pacific) office each
  // fetch their own calendar day, even though this server runs in UTC.
  const tz = office.timezone || DEFAULT_TZ;
  const { startISO, endISO, day } = zonedToday(tz);

  // Server-side date filter so Kolla returns only the current date's schedule.
  const filter = `start_time >= '${startISO}' AND start_time <= '${endISO}'`;
  const url = `${KOLLA_BASE}/appointments?filter=${encodeURIComponent(filter)}`;

  // PHI-safe log: office + scope + zone/date only — never the API key or patient data.
  console.log(`[kolla] → request office=${slug} connector=${office.kollaConnector} consumer="${office.kollaConsumer}" tz=${tz} date=${day}`);

  // Kolla Unify scopes a request to ONE office via the connector/consumer headers
  // (see kollaHeaders) — together they enforce source-level isolation between
  // practices, so this office physically cannot read another's PMS.
  // TODO(paul): confirm the exact header names against your Kolla Unify
  // dashboard/docs (some accounts use "X-Kolla-*" variants).
  const res = await fetch(url, { headers: kollaHeaders(office) });

  if (!res.ok) {
    console.error(`[kolla] ✗ failed office=${slug} status=${res.status}`);
    throw new Error(`Kolla ${res.status}`);
  }

  const data = await res.json();
  const appts = data.appointments || data.results || [];
  console.log(`[kolla] ✓ success office=${slug} status=${res.status} tz=${tz} date=${day} appointments=${appts.length}`);
  return appts;
}

// First name only. Never emit last name / PII.
// Prefer the patient's `preferred_name` (from the full Contact) when present and
// non-empty, otherwise fall back to `given_name` — first from the full Contact,
// then from the appointment's embedded short contact / other name fields.
function firstNameOf(appt, fullContact) {
  const full = fullContact || {};
  const short = appt.contact || {};
  const preferred = (full.preferred_name || "").trim();
  if (preferred) return preferred;
  const given = full.given_name || short.given_name || short.first_name
    || (short.name || appt.patient_name || "").split(" ")[0];
  return (given || "Guest").trim();
}

export default async function handler(req, res) {
  try {
    const name = (req.query.office || "").toString().toLowerCase();
    const office = OFFICES[name];

    if (!office) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(404).json({ error: "unknown_office" });
    }

    // Optional office-to-office wall: the device must present the office's code
    // (sent once, then stored in a cookie by the front end).
    if (REQUIRE_PASSCODE) {
      const given = req.headers["x-office-pass"];
      if (given !== office.passcode) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(401).json({ error: "passcode_required" });
      }
    }

    // A `demo: true` office ALWAYS serves mock data — safe to share publicly even
    // in production with a real Kolla key set. Otherwise mock only when no key.
    const useMock = office.demo === true || usingMock();
    const appts = useMock ? mockAppointments(name, office) : await fetchTodaysAppointments(office, name);

    // Resolve full contacts (for `preferred_name`) only for real Kolla data; mock
    // appointments already embed everything we need.
    const contactsById = useMock ? new Map() : await resolveContacts(office, appts, name);

    const patients = appts
      .filter(a => !["cancelled", "no_show"].includes((a.status || "").toLowerCase()))
      .map(a => ({
        id: a.id || a.name,
        first_name: firstNameOf(a, contactsById.get(a.contact_id)),
        start: a.start_time || a.startTime,
        provider: displayProvider(office, (a.provider && (a.provider.display_name || a.provider.name)) || ""),
      }))
      .filter(p => p.start)
      .sort((x, y) => new Date(x.start) - new Date(y.start));

    // Short cache so several screens at one office don't hammer Kolla, but data
    // still refreshes within a minute. (No cache for mock previews.)
    res.setHeader("X-Data-Source", useMock ? "mock" : "kolla");
    res.setHeader("Cache-Control", useMock ? "no-store" : "private, max-age=45");
    // `providers` (non-PHI) lets the screen offer doctor suggestions for walk-ins.
    // `timezone` lets the screen render times in the office's local zone.
    return res.status(200).json({
      branding: office.branding,
      providers: office.providers || [],
      timezone: office.timezone || DEFAULT_TZ,
      patients,
    });
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: "schedule_unavailable" });
  }
}
