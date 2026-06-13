import { test } from "node:test";
import assert from "node:assert/strict";
import { isHex, normalizeHex, hexToRgb, rgbToHex, darken, lighten, deriveAccents } from "../lib/colors.js";

test("isHex accepts 6-digit hex with or without #", () => {
  assert.ok(isHex("#3fa08c"));
  assert.ok(isHex("3fa08c"));
  assert.ok(!isHex("#fff"));
  assert.ok(!isHex("nope"));
  assert.ok(!isHex(123));
});

test("normalizeHex lowercases and prefixes #", () => {
  assert.equal(normalizeHex("3FA08C"), "#3fa08c");
  assert.throws(() => normalizeHex("#abc"));
});

test("hexToRgb / rgbToHex round-trip", () => {
  assert.deepEqual(hexToRgb("#3fa08c"), [63, 160, 140]);
  assert.equal(rgbToHex([63, 160, 140]), "#3fa08c");
});

test("darken returns a darker color, lighten a lighter one", () => {
  const [r, g, b] = hexToRgb("#3fa08c");
  const dk = hexToRgb(darken("#3fa08c", 0.2));
  const lt = hexToRgb(lighten("#3fa08c", 0.2));
  assert.ok(dk[0] <= r && dk[1] <= g && dk[2] <= b);
  assert.ok(lt[0] >= r && lt[1] >= g && lt[2] >= b);
});

test("deriveAccents produces three valid hex colors", () => {
  const a = deriveAccents("#5a8dd6");
  assert.equal(a.accent, "#5a8dd6");
  assert.ok(isHex(a.accentDeep));
  assert.ok(isHex(a.accentSoft));
});

test("deriveAccents honors explicit overrides", () => {
  const a = deriveAccents("#5a8dd6", { deep: "#000000", soft: "#ffffff" });
  assert.equal(a.accentDeep, "#000000");
  assert.equal(a.accentSoft, "#ffffff");
});
