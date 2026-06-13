// ─── Onboard a new client (office) in one command ────────────────────────────
// Adds (or updates) a row in offices.js, validates the slug, auto-derives accent
// shades if you only give one color, then prints the office's preview + prod URLs
// and a Chrome kiosk launch command.
//
// Examples:
//   npm run add-office -- --slug winder --consumer con_winder_123 \
//     --name "Winder Dental Care" --sub "Family & Cosmetic" --accent "#e0a64f"
//
//   npm run add-office -- --slug lamirada --consumer con_lm_9 \
//     --name "La Mirada Dental" --accent "#5a8dd6" --accent-deep "#3f6fb5" \
//     --accent-soft "#a8c4ec" --logo "https://.../logo.svg" \
//     --welcome "Welcome in — we're happy to see you." --passcode 5126 --force
//
// Flags:
//   --slug        (required)  URL path, e.g. "winder"  →  /winder
//   --connector   (required)  Kolla connector-id (which integration / PMS type)
//   --consumer    (required)  Kolla consumer-id (which specific practice)
//   --name        (required)  display name
//   --sub                     sub-line under the name
//   --accent                  primary accent hex (deep/soft derived if omitted)
//   --accent-deep --accent-soft   override the derived shades
//   --timezone                IANA tz (default America/Los_Angeles), e.g. America/Chicago
//   --providers               comma-separated doctor names, e.g. "Dr. Patel, Dr. Romero"
//   --logo                    logo image URL (defaults to a monogram letter)
//   --welcome                 welcome-screen message
//   --passcode                per-office code (only used if REQUIRE_PASSCODE on)
//   --domain                  production domain (default welcome.omnidentalservice.com)
//   --force                   overwrite an existing slug
import { readFile, writeFile } from "node:fs/promises";
import { deriveAccents, isHex } from "../lib/colors.js";
import { isValidSlug, validateOffice } from "../lib/offices.js";

const OFFICES_PATH = new URL("../offices.js", import.meta.url);
const DEFAULT_DOMAIN = "welcome.omnidentalservice.com";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) { out[key] = true; }
    else { out[key] = next; i++; }
  }
  return out;
}

function die(msg) { console.error(`\n  ✗ ${msg}\n`); process.exit(1); }

async function loadOffices() {
  // Cache-bust the import so re-runs see the latest file.
  const mod = await import(`${OFFICES_PATH.href}?t=${Date.now()}`);
  return { ...mod.OFFICES };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const slug = (args.slug || "").toString().trim().toLowerCase();
  if (!slug) die("--slug is required (the URL path, e.g. --slug winder)");
  if (!isValidSlug(slug)) die(`--slug must be url-safe (a-z, 0-9, -). got "${slug}"`);
  const name = (args.name || "").toString().trim();
  if (!name) die("--name is required (display name, e.g. --name \"Winder Dental Care\")");
  const connector = (args.connector || "").toString().trim();
  if (!connector) die("--connector is required (Kolla connector-id). Use a placeholder if you don't have it yet.");
  const consumer = (args.consumer || "").toString().trim();
  if (!consumer) die("--consumer is required (Kolla consumer-id). Use a placeholder if you don't have it yet.");

  const accentInput = (args.accent || "#e0a64f").toString().trim();
  if (!isHex(accentInput)) die(`--accent must be a 6-digit hex color. got "${accentInput}"`);

  const offices = await loadOffices();
  if (offices[slug] && !args.force) {
    die(`office "${slug}" already exists. Re-run with --force to overwrite it.`);
  }

  const { accent, accentDeep, accentSoft } = deriveAccents(accentInput, {
    deep: args["accent-deep"], soft: args["accent-soft"],
  });

  const providers = (args.providers ? args.providers.toString() : "")
    .split(",").map(s => s.trim()).filter(Boolean);

  const office = {
    kollaConnector: connector,
    kollaConsumer: consumer,
    timezone: (args.timezone || "America/Los_Angeles").toString().trim(),
    passcode: (args.passcode || "").toString().trim() || String(1000 + Math.floor(Math.random() * 9000)),
    providers,
    providerAliases: {},
    branding: {
      name,
      sub: (args.sub || "").toString().trim() || "",
      logo: args.logo ? args.logo.toString().trim() : null,
      accent, accentDeep, accentSoft,
      welcomeMsg: (args.welcome || "").toString().trim() || "We're so glad you're here.",
    },
  };

  const problems = validateOffice(slug, office);
  if (problems.length) die(`invalid office:\n    - ${problems.join("\n    - ")}`);
  offices[slug] = office;

  // Preserve everything above the generated block (header + KV TODO + hand edits).
  const text = await readFile(OFFICES_PATH, "utf8");
  const marker = "export const OFFICES";
  const idx = text.indexOf(marker);
  const header = idx >= 0 ? text.slice(0, idx) : "";
  const body = `export const OFFICES = ${JSON.stringify(offices, null, 2)};\n`;
  await writeFile(OFFICES_PATH, header + body);

  const domain = (args.domain || DEFAULT_DOMAIN).toString().trim();
  const prodUrl = `https://${domain}/${slug}`;
  console.log(`\n  ✓ ${args.force && "updated" || "added"} office "${slug}" — ${name}`);
  console.log(`\n  Preview locally:   npm run dev   →   http://localhost:3000/${slug}`);
  console.log(`  Production URL:    ${prodUrl}`);
  console.log(`  Kiosk command:     chrome --kiosk "${prodUrl}"`);
  console.log(`\n  Total offices now: ${Object.keys(offices).length}\n`);
}

main();
