import { test } from "node:test";
import assert from "node:assert/strict";
import { zonedToday, isValidTimeZone } from "../lib/time.js";

test("isValidTimeZone accepts real zones and rejects junk", () => {
  assert.ok(isValidTimeZone("America/Chicago"));
  assert.ok(isValidTimeZone("America/Los_Angeles"));
  assert.ok(!isValidTimeZone("Mars/Phobos"));
  assert.ok(!isValidTimeZone(""));
});

test("zonedToday spans exactly one calendar day (~24h) for a given instant", () => {
  // Mid-afternoon UTC so both PT and CT are on the same calendar date.
  const now = new Date("2026-06-12T20:00:00.000Z");
  const ct = zonedToday("America/Chicago", now);
  const span = new Date(ct.endISO) - new Date(ct.startISO);
  // ~24h minus 1ms
  assert.ok(span > 23.5 * 3600e3 && span < 24.5 * 3600e3, `span was ${span}ms`);
});

test("zonedToday yields different UTC windows for Central vs Pacific", () => {
  const now = new Date("2026-06-12T20:00:00.000Z");
  const ct = zonedToday("America/Chicago", now);
  const pt = zonedToday("America/Los_Angeles", now);
  // Same local date, but Pacific midnight happens 2h after Central midnight (DST).
  assert.equal(ct.day, "2026-06-12");
  assert.equal(pt.day, "2026-06-12");
  assert.notEqual(ct.startISO, pt.startISO);
  assert.equal(new Date(pt.startISO) - new Date(ct.startISO), 2 * 3600e3);
});

test("zonedToday rolls to the next local day late at night Pacific", () => {
  // 2026-06-13T05:30:00Z = 2026-06-12 22:30 PT but 2026-06-13 00:30 CT.
  const now = new Date("2026-06-13T05:30:00.000Z");
  assert.equal(zonedToday("America/Los_Angeles", now).day, "2026-06-12");
  assert.equal(zonedToday("America/Chicago", now).day, "2026-06-13");
});
