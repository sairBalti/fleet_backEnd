import fs from "fs";
import db from "../config/db.js";
import { AppError } from "../utils/AppError.js";

const MAX_MESSAGE_LEN = 2500;
const MAX_PREVIEW_ROWS = 25;
const MAX_CSV_ROWS = 100;
const MAX_COMBINED_BLOCKS = 100;
const ALLOWED_STATUS = new Set(["Route", "Rescue", "Standby", "Unavailable", "In-progress"]);

const resolveAccessScope = async (userId) => {
  const [rows] = await db.execute(
    `SELECT u.company_id, u.branch_id, lr.role_name
     FROM users u
     INNER JOIN lookup_roles lr ON lr.role_id = u.role_id
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

const allowedAiRoles = new Set([
  "SuperAdmin",
  "Admin",
  "CompanyAdmin",
  "CompanyManager",
  "BranchManager",
  "Manager",
]);

const assertCanUseScheduleAi = (roleName) => {
  if (!allowedAiRoles.has(roleName)) {
    throw new AppError("You do not have permission to create schedules from commands", 403);
  }
};

const normalizeTime = (raw) => {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  const ss = m[3] != null ? Math.min(59, Math.max(0, parseInt(m[3], 10))) : 0;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

const normalizeDate = (raw) => {
  if (!raw || typeof raw !== "string") return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
};

const sanitizeShort = (s, maxLen) => {
  if (s == null) return "";
  const t = String(s).trim();
  return t.length > maxLen ? t.slice(0, maxLen) : t;
};

/**
 * Split message into candidate schedule blocks (semicolon or blank line).
 */
const splitBlocks = (text) =>
  text
    .split(/(?:\r?\n\s*\r?\n|;)/g)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Parse one block into partial fields (driver resolved later).
 */
const parseBlock = (block) => {
  const warnings = [];
  const dateRaw = block.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const schedule_date = dateRaw ? normalizeDate(dateRaw[1]) : null;
  if (!schedule_date) warnings.push("Missing or invalid date (use YYYY-MM-DD).");

  const timeRange = block.match(/(\d{1,2}:\d{2})(?::\d{2})?\s*-\s*(\d{1,2}:\d{2})(?::\d{2})?/);
  let start_time = timeRange ? normalizeTime(timeRange[1]) : null;
  let end_time = timeRange ? normalizeTime(timeRange[2]) : null;
  if (!start_time || !end_time) warnings.push("Missing or invalid time range (use HH:MM-HH:MM).");

  let driver_id = null;
  let driver_name_hint = null;
  const idMatch = block.match(/\bdriver\s*id\s*(\d+)/i);
  if (idMatch) driver_id = Number(idMatch[1]);

  if (!driver_id) {
    const nameQuoted = block.match(/\bdriver\s+["']([^"']+)["']/i);
    const namePlain = block.match(/\bdriver\s+([^,]+?)\s+(?:date|on|\d{4}-)/i);
    const forNamed = block.match(/\bfor\s+driver\s+([^,]+?)\s+(?:date|on|\d{4}-)/i);
    driver_name_hint = sanitizeShort(nameQuoted?.[1] || namePlain?.[1] || forNamed?.[1], 120) || null;
    if (!driver_name_hint) {
      const loose = block.match(/\bdriver\s+([^,;\n]+)/i);
      driver_name_hint = loose ? sanitizeShort(loose[1].replace(/\s+date.*$/i, "").trim(), 120) : null;
    }
  }

  if (!driver_id && !driver_name_hint) warnings.push("Specify driver as driver id 12 or driver \"Alex Rivera\".");

  let route_name = "";
  const routeM = block.match(/\broute\s+([^\s,;]+|"[^"]+"|'[^']+')/i);
  if (routeM) route_name = routeM[1].replace(/^["']|["']$/g, "").trim();

  let fleet_assigned = "";
  const fleetM = block.match(/\bfleet\s+([^\s,;]+)/i);
  if (fleetM) fleet_assigned = sanitizeShort(fleetM[1], 80);

  let station = "";
  const stM = block.match(/\bstation\s+([^\s,;]+)/i);
  if (stM) station = sanitizeShort(stM[1], 50);

  let status = "Route";
  const statusM = block.match(/\bstatus\s+([^;,]+?)(?=\s*$|;|,|\n|\bfleet\b|\broute\b|\bdriver\b)/i)
    || block.match(/\bstatus\s+(.+)/i);
  if (statusM) {
    const raw = statusM[1].trim();
    const lk = raw.toLowerCase().replace(/\s+/g, "-").replace(/-+/g, "-");
    const map = {
      route: "Route",
      rescue: "Rescue",
      standby: "Standby",
      unavailable: "Unavailable",
      "in-progress": "In-progress",
      inprogress: "In-progress",
    };
    status = map[lk.replace(/-/g, "")] || map[lk] || raw;
  }

  if (!ALLOWED_STATUS.has(status)) {
    warnings.push(`Invalid status "${status}". Allowed: ${[...ALLOWED_STATUS].join(", ")}`);
  }

  const notesM = block.match(/\bnotes?\s*[:=]\s*([^;]+)$/im);
  const notes = notesM ? sanitizeShort(notesM[1], 255) : "Standard Parcel";

  return {
    partial: {
      driver_id,
      driver_name_hint,
      schedule_date,
      route_name: route_name || "Route A",
      fleet_assigned: fleet_assigned || "CDV",
      station: station || "ST-1",
      start_time,
      end_time,
      status,
      notes,
    },
    warnings,
  };
};

const resolveDriverInScope = async (partial, companyId, branchId) => {
  if (partial.driver_id) {
    const [rows] = await db.execute(
      `SELECT driver_id, driver_name FROM portal_driver_profiles
       WHERE driver_id = ? AND company_id = ? AND branch_id = ?
       LIMIT 1`,
      [partial.driver_id, companyId, branchId]
    );
    return rows[0] || null;
  }
  if (partial.driver_name_hint) {
    const [exact] = await db.execute(
      `SELECT driver_id, driver_name FROM portal_driver_profiles
       WHERE company_id = ? AND branch_id = ? AND LOWER(driver_name) = LOWER(?)
       LIMIT 1`,
      [companyId, branchId, partial.driver_name_hint]
    );
    if (exact[0]) return exact[0];
    const [like] = await db.execute(
      `SELECT driver_id, driver_name FROM portal_driver_profiles
       WHERE company_id = ? AND branch_id = ? AND driver_name LIKE ?
       LIMIT 2`,
      [companyId, branchId, `%${partial.driver_name_hint}%`]
    );
    if (like.length === 1) return like[0];
    return null;
  }
  return null;
};

const scopeCompanyBranch = (access, bodyCompanyId, bodyBranchId) => {
  let companyId = bodyCompanyId != null ? Number(bodyCompanyId) : null;
  let branchId = bodyBranchId != null ? Number(bodyBranchId) : null;

  if (!["SuperAdmin", "Admin"].includes(access.role_name)) {
    companyId = access.company_id;
    if (["BranchManager", "Driver"].includes(access.role_name)) {
      branchId = access.branch_id;
    }
  }

  if (!companyId || !branchId) {
    throw new AppError("companyId and branchId are required for this context", 400);
  }

  return { companyId, branchId };
};

const parseScheduleCsv = (content) => {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const out = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length === 1 && !cols[0]) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    out.push(row);
  }
  return out;
};

const mapStatusString = (raw) => {
  if (!raw || typeof raw !== "string") return "Route";
  const lk = raw.toLowerCase().replace(/\s+/g, "-").replace(/-+/g, "-");
  const map = {
    route: "Route",
    rescue: "Rescue",
    standby: "Standby",
    unavailable: "Unavailable",
    "in-progress": "In-progress",
    inprogress: "In-progress",
  };
  return map[lk.replace(/-/g, "")] || map[lk] || raw.trim();
};

const csvRowToPartial = (row) => {
  const warnings = [];
  let driver_id = null;
  if (row.driver_id != null && String(row.driver_id).trim() !== "") {
    const n = Number(row.driver_id);
    driver_id = Number.isNaN(n) ? null : n;
    if (driver_id === null) warnings.push("Invalid driver_id");
  }
  const driver_name_hint = sanitizeShort(row.driver_name || row.driver || "", 120) || null;

  const schedule_date = normalizeDate(String(row.schedule_date || "").trim());

  let start_time = null;
  let end_time = null;
  if (row.start_time && row.end_time) {
    start_time = normalizeTime(String(row.start_time).trim());
    end_time = normalizeTime(String(row.end_time).trim());
  } else {
    const tr = String(row.time_range || row.times || "").trim();
    const timeRange = tr.match(/(\d{1,2}:\d{2})(?::\d{2})?\s*-\s*(\d{1,2}:\d{2})(?::\d{2})?/);
    if (timeRange) {
      start_time = normalizeTime(timeRange[1]);
      end_time = normalizeTime(timeRange[2]);
    }
  }

  const status = mapStatusString(row.status || "");
  if (!ALLOWED_STATUS.has(status)) {
    warnings.push(`Invalid status "${status}"`);
  }

  const notes = row.notes ? sanitizeShort(row.notes, 255) : "Standard Parcel";

  const partial = {
    driver_id,
    driver_name_hint,
    schedule_date,
    route_name: sanitizeShort(row.route_name || row.route || "Route A", 80),
    fleet_assigned: sanitizeShort(row.fleet_assigned || row.fleet || "CDV", 80),
    station: sanitizeShort(row.station || "ST-1", 50),
    start_time,
    end_time,
    status,
    notes,
  };

  return { partial, warnings };
};

const appendPreviewEntry = async ({
  partial,
  warnings,
  previewRows,
  companyId,
  branchId,
  globalWarnings,
  label,
}) => {
  const mergedWarnings = [...(warnings || [])];

  if (!partial.schedule_date || !partial.start_time || !partial.end_time) {
    globalWarnings.push(`Skipped ${label}: incomplete date or start/end time`);
    return;
  }
  if (!ALLOWED_STATUS.has(partial.status)) {
    globalWarnings.push(`Skipped ${label}: invalid status "${partial.status}"`);
    return;
  }

  const driver = await resolveDriverInScope(partial, companyId, branchId);
  if (!driver) {
    mergedWarnings.push(
      partial.driver_id
        ? `Driver id ${partial.driver_id} not found in selected branch.`
        : `Could not resolve driver "${partial.driver_name_hint || ""}" uniquely in this branch.`
    );
    previewRows.push({
      ok: false,
      partial,
      warnings: mergedWarnings,
    });
    return;
  }

  previewRows.push({
    ok: true,
    driver_id: driver.driver_id,
    driver_name: driver.driver_name,
    schedule_date: partial.schedule_date,
    route_name: sanitizeShort(partial.route_name, 80),
    fleet_assigned: sanitizeShort(partial.fleet_assigned, 80),
    station: sanitizeShort(partial.station, 50),
    start_time: partial.start_time,
    end_time: partial.end_time,
    status: partial.status,
    notes: sanitizeShort(partial.notes, 255),
    warnings: mergedWarnings.filter(Boolean),
  });
};

export const previewScheduleAi = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Unauthorized", 401);
    assertCanUseScheduleAi(access.role_name);

    const cId = req.body.companyId ?? req.body.company_id;
    const bId = req.body.branchId ?? req.body.branch_id;
    const { companyId, branchId } = scopeCompanyBranch(access, cId, bId);

    const previewRows = [];
    const globalWarnings = [];
    let totalBlocks = 0;

    const message = req.body.message != null ? String(req.body.message) : "";

    if (req.file) {
      let raw = "";
      try {
        raw = fs.readFileSync(req.file.path, "utf8");
      } finally {
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {
          /* ignore */
        }
      }

      const csvData = parseScheduleCsv(raw);
      if (csvData.length > MAX_CSV_ROWS) {
        throw new AppError(`CSV has too many rows (max ${MAX_CSV_ROWS})`, 400);
      }
      totalBlocks += csvData.length;

      for (let i = 0; i < csvData.length; i += 1) {
        const { partial, warnings } = csvRowToPartial(csvData[i]);
        await appendPreviewEntry({
          partial,
          warnings,
          previewRows,
          companyId,
          branchId,
          globalWarnings,
          label: `CSV row ${i + 2}`,
        });
      }
    }

    if (message.trim()) {
      if (message.length > MAX_MESSAGE_LEN) {
        throw new AppError(`Message too long (max ${MAX_MESSAGE_LEN} characters)`, 400);
      }
      const blocks = splitBlocks(message);
      if (blocks.length > MAX_PREVIEW_ROWS) {
        throw new AppError(`Too many text blocks (max ${MAX_PREVIEW_ROWS})`, 400);
      }
      if (totalBlocks + blocks.length > MAX_COMBINED_BLOCKS) {
        throw new AppError(`Too many entries (max ${MAX_COMBINED_BLOCKS} combined CSV rows + text blocks)`, 400);
      }
      totalBlocks += blocks.length;

      for (let i = 0; i < blocks.length; i += 1) {
        const block = blocks[i];
        const { partial, warnings } = parseBlock(block);
        await appendPreviewEntry({
          partial,
          warnings,
          previewRows,
          companyId,
          branchId,
          globalWarnings,
          label: `text block (${block.slice(0, 48)}…)`,
        });
      }
    }

    if (!req.file && !message.trim()) {
      throw new AppError("Type a command and press Enter, or attach a CSV (plus optional note)", 400);
    }

    const okCount = previewRows.filter((r) => r.ok).length;

    return res.json({
      success: true,
      data: {
        preview: previewRows,
        summary: {
          totalBlocks,
          validRows: okCount,
          companyId,
          branchId,
        },
        hints: globalWarnings,
      },
    });
  } catch (err) {
    next(err);
  }
};

const validateCommitRow = (row) => {
  if (!row || typeof row !== "object") return "Invalid row";
  const required = [
    "driver_id",
    "schedule_date",
    "route_name",
    "fleet_assigned",
    "station",
    "start_time",
    "end_time",
    "status",
  ];
  for (const k of required) {
    if (row[k] == null || row[k] === "") return `Missing ${k}`;
  }
  if (!normalizeDate(String(row.schedule_date))) return "Invalid schedule_date";
  if (!normalizeTime(String(row.start_time)) || !normalizeTime(String(row.end_time))) return "Invalid times";
  if (!ALLOWED_STATUS.has(String(row.status))) return "Invalid status";
  return null;
};

export const commitScheduleAi = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Unauthorized", 401);
    assertCanUseScheduleAi(access.role_name);

    const { rows, companyId: cId, branchId: bId } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new AppError("rows array is required", 400);
    }
    if (rows.length > MAX_COMBINED_BLOCKS) {
      throw new AppError(`Too many rows (max ${MAX_COMBINED_BLOCKS})`, 400);
    }

    const { companyId, branchId } = scopeCompanyBranch(access, cId, bId);

    await conn.beginTransaction();

    let inserted = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const err = validateCommitRow(row);
      if (err) {
        errors.push({ index: i, message: err });
        continue;
      }

      const [drv] = await conn.execute(
        `SELECT driver_id FROM portal_driver_profiles
         WHERE driver_id = ? AND company_id = ? AND branch_id = ?
         LIMIT 1`,
        [Number(row.driver_id), companyId, branchId]
      );
      if (!drv.length) {
        errors.push({ index: i, message: "Driver not in scope" });
        continue;
      }

      const schedule_date = normalizeDate(String(row.schedule_date));
      const start_time = normalizeTime(String(row.start_time));
      const end_time = normalizeTime(String(row.end_time));

      await conn.execute(
        `DELETE FROM portal_driver_schedule WHERE driver_id = ? AND schedule_date = ?`,
        [Number(row.driver_id), schedule_date]
      );

      await conn.execute(
        `INSERT INTO portal_driver_schedule
        (driver_id, schedule_date, route_name, fleet_assigned, station, start_time, end_time, status,
         work_block_rostered, schedule_association, voluntary_extra_time, notes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          Number(row.driver_id),
          schedule_date,
          sanitizeShort(row.route_name, 80),
          sanitizeShort(row.fleet_assigned, 80),
          sanitizeShort(row.station, 50),
          start_time,
          end_time,
          String(row.status),
          34,
          0,
          0,
          sanitizeShort(row.notes || "Standard Parcel", 255),
        ]
      );
      inserted += 1;
    }

    await conn.commit();

    return res.json({
      success: true,
      data: { inserted, rejected: errors.length, errors },
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};
