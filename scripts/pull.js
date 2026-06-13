// ─── Pull & print one office's schedule from the CLI (local test) ────────────
// Loads .env.local, runs the REAL serverless handler, and prints the sanitized
// result — the exact { branding, patients } the screen receives. Great for
// confirming your Kolla key + consumer scoping work before opening a browser.
//
//   npm run pull -- inspire           # uses .env.local (live if key set, else mock)
//   MOCK=1 npm run pull -- inspire     # force mock
//
// Only first_name / start / provider are ever printed — never last name or PII.
import "./_env.js";
import handler from "../api/schedule.js";

const slug = (process.argv[2] || "").toString().toLowerCase().trim();
if (!slug) {
  console.error("\n  usage: npm run pull -- <office-slug>   (e.g. npm run pull -- inspire)\n");
  process.exit(1);
}

const req = { method: "GET", headers: {}, query: { office: slug } };

let statusCode = 200;
const headers = {};
const res = {
  setHeader: (k, v) => { headers[k] = v; },
  status(code) { statusCode = code; return this; },
  json(body) {
    const source = headers["X-Data-Source"] || "n/a";
    console.log(`\n  GET /api/schedule?office=${slug}`);
    console.log(`  status: ${statusCode}   data-source: ${source}`);
    if (body && body.branding) {
      console.log(`  office: ${body.branding.name}  (accent ${body.branding.accent})`);
      console.log(`  patients today: ${body.patients.length}`);
      for (const p of body.patients) {
        const t = new Date(p.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        console.log(`    • ${String(p.first_name).padEnd(12)} ${t.padStart(8)}   ${p.provider || ""}`);
      }
    } else {
      console.log("  body:", JSON.stringify(body));
    }
    console.log("");
    return this;
  },
};

await handler(req, res);
