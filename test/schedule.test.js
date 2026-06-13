import { test } from "node:test";
import assert from "node:assert/strict";
import { callSchedule, withEnv, withStubbedFetch, jsonResponse } from "./helper.js";
import { OFFICES } from "../offices.js";

const ALLOWED_KEYS = ["id", "first_name", "start", "provider"];

test("unknown office returns 404", async () => {
  await withEnv({ MOCK: "1" }, async () => {
    const { status, body } = await callSchedule({ office: "does-not-exist" });
    assert.equal(status, 404);
    assert.equal(body.error, "unknown_office");
  });
});

test("mock mode returns branding, configurable providers, and a roster", async () => {
  await withEnv({ MOCK: "1" }, async () => {
    const { status, headers, body } = await callSchedule({ office: "inspire-dental-tigard" });
    assert.equal(status, 200);
    assert.equal(headers["X-Data-Source"], "mock");
    assert.equal(body.branding.name, "Inspire Dental");
    assert.deepEqual(body.providers, OFFICES["inspire-dental-tigard"].providers);
    assert.equal(body.timezone, OFFICES["inspire-dental-tigard"].timezone);
    assert.ok(body.patients.length > 0);
  });
});

test("mock rosters only use the office's configured doctors", async () => {
  await withEnv({ MOCK: "1" }, async () => {
    const { body } = await callSchedule({ office: "fresh-smile-dental" });
    const allowed = new Set(OFFICES["fresh-smile-dental"].providers);
    for (const p of body.patients) assert.ok(allowed.has(p.provider), `unexpected doctor ${p.provider}`);
  });
});

test("patient objects expose ONLY first_name/start/provider (no PII leak)", async () => {
  await withEnv({ MOCK: "1" }, async () => {
    const { body } = await callSchedule({ office: "inspire-dental-tigard" });
    for (const p of body.patients) {
      assert.deepEqual(Object.keys(p).sort(), [...ALLOWED_KEYS].sort());
    }
  });
});

test("live mode: filters cancelled, sorts by time, aliases providers, never leaks last name", async () => {
  const kollaPayload = {
    appointments: [
      { id: "a3", status: "confirmed", start_time: "2030-01-01T17:00:00.000Z",
        contact: { given_name: "Robert", family_name: "Hidden", last_name: "Hidden" },
        provider: { display_name: "DR. J. ALVAREZ" } },
      { id: "a1", status: "confirmed", start_time: "2030-01-01T09:00:00.000Z",
        contact: { given_name: "Maria", last_name: "ShouldNotAppear" },
        provider: { display_name: "KIM, SUSAN DDS" } },
      { id: "a2", status: "cancelled", start_time: "2030-01-01T10:00:00.000Z",
        contact: { given_name: "Cancelled", last_name: "Person" },
        provider: { display_name: "DR. J. ALVAREZ" } },
    ],
  };

  await withEnv({ KOLLA_API_KEY: "test-key", MOCK: undefined }, async () => {
    await withStubbedFetch(async () => jsonResponse(kollaPayload), async () => {
      const { status, headers, body } = await callSchedule({ office: "la-mirada-one-dental" });
      assert.equal(status, 200);
      assert.equal(headers["X-Data-Source"], "kolla");

      // cancelled removed
      assert.equal(body.patients.length, 2);
      // sorted by start
      assert.deepEqual(body.patients.map(p => p.first_name), ["Maria", "Robert"]);
      // provider aliases applied
      assert.equal(body.patients[0].provider, "Dr. Kim");
      assert.equal(body.patients[1].provider, "Dr. Alvarez");
      // absolutely no last name anywhere in the payload
      assert.ok(!JSON.stringify(body).includes("Hidden"));
      assert.ok(!JSON.stringify(body).includes("ShouldNotAppear"));
    });
  });
});

test("live mode: Kolla failure degrades to 502 without throwing", async () => {
  await withEnv({ KOLLA_API_KEY: "test-key", MOCK: undefined }, async () => {
    await withStubbedFetch(async () => ({ ok: false, status: 500 }), async () => {
      const { status, body } = await callSchedule({ office: "inspire-dental-tigard" });
      assert.equal(status, 502);
      assert.equal(body.error, "schedule_unavailable");
    });
  });
});
