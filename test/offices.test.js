import { test } from "node:test";
import assert from "node:assert/strict";
import { OFFICES } from "../offices.js";
import { validateDirectory, validateOffice, isValidSlug } from "../lib/offices.js";
import { isValidTimeZone } from "../lib/time.js";

test("every office in the directory is valid", () => {
  const { ok, problems } = validateDirectory(OFFICES);
  assert.ok(ok, `invalid offices: ${JSON.stringify(problems, null, 2)}`);
});

test("all slugs are url-safe (safe to use as a URL path)", () => {
  for (const slug of Object.keys(OFFICES)) {
    assert.ok(isValidSlug(slug), `slug "${slug}" is not url-safe`);
  }
});

test("each office has at least one configurable provider", () => {
  for (const [slug, office] of Object.entries(OFFICES)) {
    assert.ok(Array.isArray(office.providers) && office.providers.length > 0,
      `office "${slug}" should list its doctors in providers[]`);
  }
});

test("each office declares a valid IANA timezone", () => {
  for (const [slug, office] of Object.entries(OFFICES)) {
    assert.ok(office.timezone, `office "${slug}" is missing a timezone`);
    assert.ok(isValidTimeZone(office.timezone), `office "${slug}" has invalid timezone ${office.timezone}`);
  }
});

test("validateOffice flags missing branding colors", () => {
  const errors = validateOffice("demo", {
    kollaConsumer: "con_x",
    branding: { name: "Demo", accent: "nothex", accentDeep: "#111111", accentSoft: "#eeeeee" },
  });
  assert.ok(errors.some(e => e.includes("accent")));
});

test("validateOffice rejects an unsafe slug", () => {
  const errors = validateOffice("Bad Slug!", {
    kollaConsumer: "con_x",
    branding: { name: "X", accent: "#111111", accentDeep: "#111111", accentSoft: "#eeeeee" },
  });
  assert.ok(errors.some(e => e.includes("url-safe")));
});
