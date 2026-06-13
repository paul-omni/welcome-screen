// Loads .env.local into process.env for LOCAL tooling only (dev server, pull).
// - Safe if the file is missing (fresh clones won't have it — it's gitignored).
// - Never overrides a value already set in the real environment (so CI/Vercel win).
// - This file is only imported by local scripts; it is NOT part of the deployed
//   serverless function, and the secret never reaches the browser.
import { readFileSync, existsSync } from "node:fs";

const ENV_PATH = new URL("../.env.local", import.meta.url);

if (existsSync(ENV_PATH)) {
  const text = readFileSync(ENV_PATH, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
