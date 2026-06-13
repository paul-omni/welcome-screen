// Test helper: invoke the real serverless handler with a Vercel-style req/res
// shim and capture status, headers, and JSON body. Also lets a test temporarily
// stub global fetch (to simulate Kolla) and reset env between cases.
import handler from "../api/schedule.js";

export async function callSchedule(query, { headers = {} } = {}) {
  let status = 200;
  const resHeaders = {};
  let body;
  const req = { method: "GET", headers, query };
  const res = {
    setHeader: (k, v) => { resHeaders[k] = v; },
    status(code) { status = code; return this; },
    json(payload) { body = payload; return this; },
  };
  await handler(req, res);
  return { status, headers: resHeaders, body };
}

// Run `fn` with a stubbed global fetch, restoring the original afterward.
export async function withStubbedFetch(impl, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try { return await fn(); }
  finally { globalThis.fetch = original; }
}

// Run `fn` with specific env vars set, restoring previous values afterward.
export async function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try { return await fn(); }
  finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

export function jsonResponse(payload) {
  return { ok: true, status: 200, json: async () => payload };
}
