// Office-directory helpers: validation + slug rules shared by the app, the
// onboarding script, and tests. Keeps "what a valid office looks like" in one
// place so every entry in offices.js stays consistent.
import { isHex } from "./colors.js";
import { isValidTimeZone } from "./time.js";

export const SLUG_RE = /^[a-z0-9-]+$/;

export function isValidSlug(slug) {
  return typeof slug === "string" && SLUG_RE.test(slug);
}

// Returns an array of human-readable problems; empty array means valid.
export function validateOffice(slug, office) {
  const errors = [];
  if (!isValidSlug(slug)) errors.push(`slug "${slug}" must be url-safe (a-z, 0-9, -)`);
  if (!office || typeof office !== "object") return [...errors, "office row is missing"];

  if (!office.kollaConnector) errors.push("kollaConnector is required (Kolla connector-id)");
  if (!office.kollaConsumer) errors.push("kollaConsumer is required (Kolla consumer-id)");
  if (!office.timezone) errors.push("timezone is required (IANA, e.g. America/Chicago)");
  else if (!isValidTimeZone(office.timezone)) errors.push(`timezone "${office.timezone}" is not a valid IANA timezone`);

  if (office.providers !== undefined) {
    if (!Array.isArray(office.providers)) errors.push("providers must be an array of names");
    else if (office.providers.some(p => typeof p !== "string" || !p.trim()))
      errors.push("providers must all be non-empty strings");
  }
  if (office.providerAliases !== undefined &&
      (typeof office.providerAliases !== "object" || office.providerAliases === null ||
       Array.isArray(office.providerAliases))) {
    errors.push("providerAliases must be an object of { rawName: displayName }");
  }

  const b = office.branding;
  if (!b || typeof b !== "object") return [...errors, "branding is required"];
  if (!b.name || typeof b.name !== "string") errors.push("branding.name is required");
  for (const key of ["accent", "accentDeep", "accentSoft"]) {
    if (!isHex(b[key] || "")) errors.push(`branding.${key} must be a 6-digit hex color`);
  }
  if (b.logo !== null && b.logo !== undefined && typeof b.logo !== "string") {
    errors.push("branding.logo must be a URL string or null");
  }
  return errors;
}

// Validate every office in a directory. Returns { ok, problems: { slug: [...] } }.
export function validateDirectory(offices) {
  const problems = {};
  for (const [slug, office] of Object.entries(offices)) {
    const errors = validateOffice(slug, office);
    if (errors.length) problems[slug] = errors;
  }
  return { ok: Object.keys(problems).length === 0, problems };
}
