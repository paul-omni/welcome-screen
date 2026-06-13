// ─── Offline local preview (no Vercel login needed) ──────────────────────────
// Mimics vercel.json: every non-/api path serves index.html, and /api/schedule
// runs the real serverless handler. With no KOLLA_API_KEY set, the handler is in
// mock mode, so each office URL renders fully branded with a fake roster.
//
//   npm run dev      →  http://localhost:3000/inspire
//
// This is just for eyeballing branding/layout. Production still runs on Vercel.
import "./_env.js";   // load .env.local (if present) before anything reads env
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import handler from "../api/schedule.js";
import { OFFICES } from "../offices.js";

const PORT = Number(process.env.PORT) || 3000;
const INDEX = new URL("../index.html", import.meta.url);

// Minimal Vercel-style res shim around Node's ServerResponse.
function shimRes(res) {
  return {
    setHeader: (k, v) => res.setHeader(k, v),
    status(code) { res.statusCode = code; return this; },
    json(obj) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(obj));
      return this;
    },
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/api/schedule") {
    const shimReq = {
      method: req.method,
      headers: req.headers,
      query: Object.fromEntries(url.searchParams),
    };
    try {
      await handler(shimReq, shimRes(res));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "dev_server_error", detail: String(err) }));
    }
    return;
  }

  // Everything else → index.html (the vercel.json rewrite).
  try {
    const html = await readFile(INDEX);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch {
    res.writeHead(500); res.end("index.html not found");
  }
});

server.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log(`\n  ▶  Omni welcome — local preview running at ${base}`);
  console.log(`     Data source: ${process.env.KOLLA_API_KEY ? "Kolla (live)" : "MOCK (no key set)"}\n`);
  console.log("  Open an office:");
  for (const slug of Object.keys(OFFICES)) {
    console.log(`     • ${OFFICES[slug].branding.name.padEnd(20)} ${base}/${slug}`);
  }
  console.log("");
});
