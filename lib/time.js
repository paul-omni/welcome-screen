// Timezone helpers — compute "today" in a specific IANA timezone, with no deps.
// Used so each office fetches ONLY its own local calendar day from Kolla, even
// though the server (Vercel) runs in UTC.

export function isValidTimeZone(tz) {
  if (typeof tz !== "string" || !tz) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; }
  catch { return false; }
}

// Offset (ms) between the given timezone and UTC at a specific instant:
// localWallClock - utc. Positive east of UTC, negative west.
function tzOffsetMs(tz, date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const hour = p.hour === "24" ? "00" : p.hour;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +hour, +p.minute, +p.second);
  return asUTC - date.getTime();
}

// Convert a wall-clock time IN `tz` to the corresponding UTC instant, handling
// DST by refining the offset once.
export function zonedWallToUTC(tz, y, m, d, H, Mi, S, Ms) {
  const guess = Date.UTC(y, m - 1, d, H, Mi, S, Ms);
  const off1 = tzOffsetMs(tz, new Date(guess));
  let result = guess - off1;
  const off2 = tzOffsetMs(tz, new Date(result));
  if (off2 !== off1) result = guess - off2;
  return new Date(result);
}

const pad = n => String(n).padStart(2, "0");

// The start/end UTC instants of the current calendar day in `tz`, plus the
// office-local date string (YYYY-MM-DD). `now` is injectable for testing.
export function zonedToday(tz, now = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const [y, m, d] = dtf.format(now).split("-").map(Number);
  return zonedDayRange(tz, y, m, d);
}

// The start/end UTC instants of a SPECIFIC calendar day in `tz`, given a
// "YYYY-MM-DD" string. Returns null if the string isn't a real date (e.g.
// "2026-02-30" or malformed), so callers can reject bad input. Used to let a
// `?date=` URL param fetch a chosen day instead of today.
export function zonedDay(tz, dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateStr || "").trim());
  if (!match) return null;
  const y = +match[1], m = +match[2], d = +match[3];
  // Reject impossible dates (overflow) via a UTC round-trip check.
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return zonedDayRange(tz, y, m, d);
}

// Shared: build the start/end UTC window + local day string for y-m-d in `tz`.
function zonedDayRange(tz, y, m, d) {
  const start = zonedWallToUTC(tz, y, m, d, 0, 0, 0, 0);
  const end = zonedWallToUTC(tz, y, m, d, 23, 59, 59, 999);
  return { startISO: start.toISOString(), endISO: end.toISOString(), day: `${y}-${pad(m)}-${pad(d)}` };
}
