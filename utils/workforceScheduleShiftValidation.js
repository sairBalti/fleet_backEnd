/**
 * Shared rules for construction workforce shift scheduling (past window, overlap, duplicate).
 * Used by workforceController; mirror critical checks on the client where noted.
 */

const DAY_MIN = 24 * 60;

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** @param {Date} d */
export function formatLocalYmd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Normalize MySQL DATE / datetime / string to YYYY-MM-DD (matches SQL civil date; mysql2 DATE → UTC midnight). */
export function sqlDateToYmd(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const utcMidnight =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;
  if (utcMidnight) {
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  return formatLocalYmd(d);
}

export function addDaysIso(ymd, deltaDays) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return formatLocalYmd(dt);
}

export function ymdCompare(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function dayInRange(dayIso, startIso, endIso) {
  return ymdCompare(dayIso, startIso) >= 0 && ymdCompare(dayIso, endIso) <= 0;
}

/** @param {string|Date} t TIME from MySQL or "HH:MM:SS" */
export function timeToMinutes(t) {
  if (t == null) return 0;
  if (t instanceof Date) {
    return t.getHours() * 60 + t.getMinutes() + t.getSeconds() / 60;
  }
  const s = String(t).slice(0, 8);
  const parts = s.split(":");
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  const sec = Number(parts[2]) || 0;
  return Math.round(h * 60 + m + sec / 60);
}

export function minutesToTimeSql(mins) {
  const m = Math.max(0, Math.min(DAY_MIN - 1, Math.round(mins)));
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return `${pad2(h)}:${pad2(mi)}:00`;
}

export const SCHEDULE_SLOT_ORDER = ["Midnight", "Morning", "Afternoon", "NightShift"];

/** Slot label from check-in time (5:00–11:59 morning, etc.). */
export function timeSlotFromCheckinMinutes(mins) {
  const m = ((mins % DAY_MIN) + DAY_MIN) % DAY_MIN;
  if (m < 5 * 60) return "Midnight";
  if (m < 12 * 60) return "Morning";
  if (m < 18 * 60) return "Afternoon";
  return "NightShift";
}

export function timeSlotFromCheckinSqlTime(checkin) {
  return timeSlotFromCheckinMinutes(timeToMinutes(checkin));
}

export function slotDefaultCheckinMinutes(slot) {
  switch (slot) {
    case "Midnight":
      return 0;
    case "Morning":
      return 5 * 60;
    case "Afternoon":
      return 12 * 60;
    case "NightShift":
      return 18 * 60;
    default:
      return 8 * 60;
  }
}

function mergeIntervals(intervals) {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const out = [sorted[0].slice()];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur[0] <= last[1]) last[1] = Math.max(last[1], cur[1]);
    else out.push(cur.slice());
  }
  return out;
}

/**
 * Busy intervals on a calendar day (0–1440 minutes) for a recurring daily check-in/out pattern.
 * @param {{ shift_start: string, shift_end: string, checkin_time: unknown, checkout_time: unknown }} shift
 */
export function intervalsOnCalendarDay(shift, dayIso) {
  const { shift_start, shift_end, checkin_time, checkout_time } = shift;
  const ci = timeToMinutes(checkin_time);
  const co = timeToMinutes(checkout_time);
  const intervals = [];

  const prev = addDaysIso(dayIso, -1);
  if (dayInRange(prev, shift_start, shift_end) && co < ci) {
    intervals.push([0, co]);
  }

  if (dayInRange(dayIso, shift_start, shift_end)) {
    if (co >= ci) intervals.push([ci, co]);
    else intervals.push([ci, DAY_MIN]);
  }

  return mergeIntervals(intervals);
}

function pairOverlaps(a, b) {
  return a[0] < b[1] && b[0] < a[1];
}

export function dayIntervalsOverlap(shiftA, shiftB, dayIso) {
  const ia = intervalsOnCalendarDay(shiftA, dayIso);
  const ib = intervalsOnCalendarDay(shiftB, dayIso);
  for (const a of ia) {
    for (const b of ib) {
      if (pairOverlaps(a, b)) return true;
    }
  }
  return false;
}

export function dateRangesOverlap(startA, endA, startB, endB) {
  return !(endA < startB || endB < startA);
}

function eachIntersectionDay(startA, endA, startB, endB, fn) {
  const s = ymdCompare(startA, startB) >= 0 ? startA : startB;
  const e = ymdCompare(endA, endB) <= 0 ? endA : endB;
  if (ymdCompare(s, e) > 0) return;
  let cur = s;
  for (;;) {
    fn(cur);
    if (cur === e) break;
    cur = addDaysIso(cur, 1);
  }
}

export function shiftsTimeOverlap(shiftA, shiftB) {
  if (!dateRangesOverlap(shiftA.shift_start, shiftA.shift_end, shiftB.shift_start, shiftB.shift_end)) {
    return false;
  }
  let hit = false;
  eachIntersectionDay(shiftA.shift_start, shiftA.shift_end, shiftB.shift_start, shiftB.shift_end, (day) => {
    if (!hit && dayIntervalsOverlap(shiftA, shiftB, day)) hit = true;
  });
  return hit;
}

export function isDuplicateShiftWindow(a, b) {
  return (
    String(a.shift_name || "") === String(b.shift_name || "") &&
    String(a.shift_start) === String(b.shift_start) &&
    String(a.shift_end) === String(b.shift_end) &&
    timeToMinutes(a.checkin_time) === timeToMinutes(b.checkin_time) &&
    timeToMinutes(a.checkout_time) === timeToMinutes(b.checkout_time)
  );
}

/**
 * @param {{ shift_id?: number, employee_id: number, shift_start: string, shift_end: string, checkin_time: unknown, checkout_time: unknown, shift_name?: string }} incoming
 * @param {Array<{ shift_id: number, shift_start: string, shift_end: string, checkin_time: unknown, checkout_time: unknown, shift_name?: string }>} existing
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateShiftAgainstExisting(incoming, existing) {
  const errors = [];
  const warnings = []; // reserved for non-blocking hints (API still saves only when errors.length === 0)
  const selfId = Number(incoming.shift_id || 0);

  for (const row of existing) {
    const oid = Number(row.shift_id);
    if (oid === selfId) continue;

    const other = {
      shift_start: sqlDateToYmd(row.shift_start),
      shift_end: sqlDateToYmd(row.shift_end),
      checkin_time: row.checkin_time,
      checkout_time: row.checkout_time,
      shift_name: row.shift_name,
    };

    const cur = {
      shift_start: sqlDateToYmd(incoming.shift_start),
      shift_end: sqlDateToYmd(incoming.shift_end),
      checkin_time: incoming.checkin_time,
      checkout_time: incoming.checkout_time,
      shift_name: incoming.shift_name,
    };

    if (isDuplicateShiftWindow(cur, other)) {
      errors.push(
        `Same shift window already exists for this employee (shift #${oid}, "${other.shift_name || "Shift"}"). Edit that shift instead of creating a duplicate.`
      );
      continue;
    }

    if (shiftsTimeOverlap(cur, other)) {
      errors.push(
        `Overlaps shift #${oid} (${other.shift_start} → ${other.shift_end}, ${String(other.checkin_time).slice(0, 5)}–${String(other.checkout_time).slice(0, 5)}).`
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * @param {string} shiftStartYmd
 * @param {unknown} checkinTime
 * @param {{ curDate: string, curTime: string }} dbNow from SELECT CURDATE(), CURTIME() as strings
 */
export function validateShiftNotInPast(shiftStartYmd, checkinTime, dbNow) {
  const errors = [];
  const d = String(shiftStartYmd).slice(0, 10);
  const curDate = String(dbNow.curDate).slice(0, 10);
  if (d < curDate) {
    errors.push("Shift start date cannot be in the past.");
  } else if (d === curDate && timeToMinutes(checkinTime) < timeToMinutes(dbNow.curTime)) {
    errors.push("Check-in time cannot be earlier than the current time when the shift starts today.");
  }
  return { ok: errors.length === 0, errors };
}

/** Shift must still include today or a future day (no fully historical ranges). */
export function validateShiftEndNotFullyPast(shiftEndYmd, dbNow) {
  const errors = [];
  const e = String(shiftEndYmd).slice(0, 10);
  const curDate = String(dbNow.curDate).slice(0, 10);
  if (e < curDate) {
    errors.push("Shift end date cannot be entirely in the past.");
  }
  return { ok: errors.length === 0, errors };
}
