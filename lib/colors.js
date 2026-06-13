// Small, dependency-free hex-color helpers. Used by the onboarding script to
// derive accent shades from a single brand color, and covered by tests.

export function isHex(value) {
  return typeof value === "string" && /^#?[0-9a-fA-F]{6}$/.test(value.trim());
}

export function normalizeHex(value) {
  if (!isHex(value)) throw new Error(`not a 6-digit hex color: "${value}"`);
  return `#${value.trim().replace(/^#/, "").toLowerCase()}`;
}

export function hexToRgb(value) {
  const hex = normalizeHex(value).slice(1);
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

// f in 0..1 — fraction toward black.
export function darken(value, f) {
  return rgbToHex(hexToRgb(value).map(v => v * (1 - f)));
}

// f in 0..1 — fraction toward white.
export function lighten(value, f) {
  return rgbToHex(hexToRgb(value).map(v => v + (255 - v) * f));
}

// Given one accent, produce the trio the screen themes from. Explicit overrides win.
export function deriveAccents(accent, { deep, soft } = {}) {
  return {
    accent: normalizeHex(accent),
    accentDeep: deep ? normalizeHex(deep) : darken(accent, 0.16),
    accentSoft: soft ? normalizeHex(soft) : lighten(accent, 0.42),
  };
}
