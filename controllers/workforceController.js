import db from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import {
  timeToMinutes,
  validateShiftAgainstExisting,
  validateShiftEndNotFullyPast,
  validateShiftNotInPast,
} from "../utils/workforceScheduleShiftValidation.js";

const BRANCH_SCOPED_ROLES = new Set([
  "BranchManager",
  "Driver",
  "Maintenance",
  "Supervisor",
  "Worker",
  "Contractor",
]);

const ADMIN_ROLES = new Set(["SuperAdmin", "Admin"]);

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

const scope = (access, companyId, branchId) => {
  let c = companyId != null ? Number(companyId) : null;
  let b = branchId != null ? Number(branchId) : null;
  if (!ADMIN_ROLES.has(access.role_name)) {
    c = access.company_id;
    if (BRANCH_SCOPED_ROLES.has(access.role_name)) b = access.branch_id;
  }
  return { companyId: c, branchId: b };
};

export const listEmployees = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const { companyId, branchId, searchText, isActive, sortColumn, sortDirection, pageNumber, pageSize } = req.query;
    const scoped = scope(access, companyId, branchId);
    if (!scoped.companyId) {
      return res.json({
        success: true,
        data: [],
        pagination: { pageNumber: 1, pageSize: 20, totalRecords: 0 },
      });
    }
    const pn = Math.max(1, Number(pageNumber) || 1);
    const ps = Math.max(1, Math.min(500, Number(pageSize) || 20));
    const sortCol = String(sortColumn || "employee_name").slice(0, 40);
    const sortDir = String(sortDirection || "ASC").toUpperCase() === "DESC" ? "DESC" : "ASC";

    const [packet] = await db.execute("CALL construction_spEmployeesList(?,?,?,?,?,?,?,?)", [
      scoped.companyId,
      scoped.branchId,
      searchText || null,
      isActive === undefined ? null : Number(isActive),
      sortCol,
      sortDir,
      pn,
      ps,
    ]);

    const totalRecords = Number(packet?.[0]?.[0]?.totalRecords ?? 0);
    const rows = Array.isArray(packet?.[1]) ? packet[1] : [];

    return res.json({
      success: true,
      data: rows,
      pagination: {
        pageNumber: pn,
        pageSize: ps,
        totalRecords,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listConsEmployeeLookup = async (_req, res, next) => {
  try {
    const [result] = await db.execute("CALL construction_spConsEmployeeLookupList()");
    return res.json({ success: true, data: result?.[0] || [] });
  } catch (error) {
    next(error);
  }
};

export const upsertEmployee = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const body = req.body || {};
    const scoped = scope(access, body.company_id, body.branch_id);
    if (!scoped.companyId || !scoped.branchId) throw new AppError("company_id and branch_id required", 400);
    if (!body.employee_code || !body.employee_name) throw new AppError("employee_code and employee_name required", 400);

    const [result] = await db.execute("CALL construction_spEmployeeUpsert(?,?,?,?,?,?,?,?,?,?,?)", [
      Number(body.employee_id || 0),
      scoped.companyId,
      scoped.branchId,
      body.user_id ? Number(body.user_id) : null,
      String(body.employee_code).trim(),
      String(body.employee_name).trim(),
      body.role_title || null,
      body.contact_phone || null,
      body.employment_type || "Full Time",
      body.hourly_rate != null && body.hourly_rate !== "" ? Number(body.hourly_rate) : null,
      body.is_active == null ? 1 : Number(body.is_active),
    ]);
    return res.json({ success: true, data: { employee_id: Number(result?.[0]?.[0]?.employee_id || 0) } });
  } catch (error) {
    next(error);
  }
};

export const upsertShiftSchedule = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const body = req.body || {};
    const scoped = scope(access, body.company_id, body.branch_id);
    if (!scoped.companyId || !scoped.branchId) throw new AppError("company_id and branch_id required", 400);
    if (String(body.shift_start).slice(0, 10) > String(body.shift_end).slice(0, 10)) {
      throw new AppError("shift_start cannot be after shift_end", 400);
    }

    const [[dbNowRow]] = await db.execute(
      "SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS curDate, DATE_FORMAT(CURTIME(), '%H:%i:%s') AS curTime"
    );
    const dbNow = { curDate: dbNowRow?.curDate, curTime: dbNowRow?.curTime };

    const pastStart = validateShiftNotInPast(body.shift_start, body.checkin_time, dbNow);
    const pastEnd = validateShiftEndNotFullyPast(body.shift_end, dbNow);
    const pastErrors = [...pastStart.errors, ...pastEnd.errors];
    if (pastErrors.length) {
      return res.status(400).json({
        success: false,
        code: "SHIFT_PAST",
        message: pastErrors[0],
        errors: pastErrors,
        warnings: [],
      });
    }

    const shiftIdExclude = Number(body.shift_id || 0);
    const [overlapRows] = await db.execute(
      `SELECT shift_id, shift_start, shift_end, checkin_time, checkout_time, shift_name
       FROM shift_schedules
       WHERE company_id = ?
         AND (branch_id <=> ?)
         AND employee_id = ?
         AND shift_id <> ?
         AND NOT (shift_end < ? OR shift_start > ?)`,
      [
        scoped.companyId,
        scoped.branchId,
        Number(body.employee_id),
        shiftIdExclude,
        String(body.shift_end).slice(0, 10),
        String(body.shift_start).slice(0, 10),
      ]
    );

    const overlapCheck = validateShiftAgainstExisting(
      {
        shift_id: shiftIdExclude,
        employee_id: Number(body.employee_id),
        shift_start: body.shift_start,
        shift_end: body.shift_end,
        checkin_time: body.checkin_time,
        checkout_time: body.checkout_time,
        shift_name: body.shift_name || "General Shift",
      },
      overlapRows || []
    );

    if (!overlapCheck.ok) {
      return res.status(400).json({
        success: false,
        code: "SHIFT_CONFLICT",
        message: overlapCheck.errors[0] || "Shift conflicts with an existing schedule.",
        errors: overlapCheck.errors,
        warnings: overlapCheck.warnings,
      });
    }

    const sqlTimeOrNull = (v) => {
      if (v == null || v === "") return null;
      const s = String(v).trim();
      if (!s) return null;
      if (s.length <= 5) return `${s}:00`;
      return s.slice(0, 8);
    };
    const breakStart = sqlTimeOrNull(body.break_start);
    const breakEnd = sqlTimeOrNull(body.break_end);
    if ((breakStart && !breakEnd) || (!breakStart && breakEnd)) {
      throw new AppError("Meal break requires both start and end times, or omit both.", 400);
    }
    const ciM = timeToMinutes(body.checkin_time);
    const coM = timeToMinutes(body.checkout_time);
    if (breakStart && breakEnd) {
      const b1 = timeToMinutes(breakStart);
      const b2 = timeToMinutes(breakEnd);
      if (b2 <= b1) {
        throw new AppError("Meal break end must be after meal break start (same calendar day).", 400);
      }
      if (coM >= ciM) {
        if (b1 < ciM || b2 > coM) {
          throw new AppError("Meal break must fall between shift check-in and check-out times.", 400);
        }
      }
    }

    const [result] = await db.execute("CALL construction_spShiftUpsert(?,?,?,?,?,?,?,?,?,?,?,?)", [
      shiftIdExclude,
      scoped.companyId,
      scoped.branchId,
      Number(body.employee_id),
      body.shift_name || "General Shift",
      body.shift_start,
      body.shift_end,
      body.checkin_time,
      body.checkout_time,
      body.shift_hours != null && body.shift_hours !== "" ? Number(body.shift_hours) : 8,
      breakStart,
      breakEnd,
    ]);
    return res.json({
      success: true,
      data: { shift_id: Number(result?.[0]?.[0]?.shift_id || 0) },
      warnings: overlapCheck.warnings,
    });
  } catch (error) {
    next(error);
  }
};

export const assignWorker = async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.project_id || !body.employee_id || !body.assignment_role || !body.assigned_date) {
      throw new AppError("project_id, employee_id, assignment_role, assigned_date required", 400);
    }
    const [result] = await db.execute("CALL construction_spAssignWorker(?,?,?,?)", [
      Number(body.project_id),
      Number(body.employee_id),
      String(body.assignment_role).trim(),
      body.assigned_date,
    ]);
    return res.json({ success: true, data: { worker_assignment_id: Number(result?.[0]?.[0]?.worker_assignment_id || 0) } });
  } catch (error) {
    next(error);
  }
};

export const markAttendance = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const body = req.body || {};
    const scoped = scope(access, body.company_id, body.branch_id);
    if (!scoped.companyId || !scoped.branchId) throw new AppError("company_id and branch_id required", 400);
    if (!body.employee_id || !body.attendance_date) throw new AppError("employee_id and attendance_date required", 400);

    const [result] = await db.execute("CALL construction_spAttendanceUpsert(?,?,?,?,?,?,?,?)", [
      scoped.companyId,
      scoped.branchId,
      Number(body.employee_id),
      body.attendance_date,
      body.status || "Present",
      body.check_in || null,
      body.check_out || null,
      body.daily_log || null,
    ]);
    return res.json({ success: true, data: result?.[0]?.[0] || {} });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceReport = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const { companyId, branchId, attendanceDate, employeeId } = req.query;
    const scoped = scope(access, companyId, branchId);
    if (!scoped.companyId) return res.json({ success: true, data: [] });
    const targetDate =
      attendanceDate ||
      (() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      })();
    const [result] = await db.execute("CALL construction_spAttendanceDailyReport(?,?,?,?)", [
      scoped.companyId,
      scoped.branchId,
      targetDate,
      employeeId ? Number(employeeId) : null,
    ]);
    return res.json({ success: true, data: result?.[0] || [] });
  } catch (error) {
    next(error);
  }
};

export const getWorkforceAnalytics = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const { companyId, branchId, employeeId } = req.query;
    const scoped = scope(access, companyId, branchId);
    if (!scoped.companyId) return res.json({ success: true, data: { summary: {}, trend: [] } });
    const [result] = await db.execute("CALL construction_spWorkforceAnalytics(?,?,?)", [
      scoped.companyId,
      scoped.branchId,
      employeeId ? Number(employeeId) : null,
    ]);
    return res.json({
      success: true,
      data: {
        summary: result?.[0]?.[0] || {},
        trend: result?.[1] || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkforceScheduleMonth = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const { companyId, branchId, month, from, to } = req.query;
    const scoped = scope(access, companyId, branchId);
    if (!scoped.companyId) return res.json({ success: true, data: [] });

    const fromStr = String(from || "").trim();
    const toStr = String(to || "").trim();
    if (fromStr && toStr) {
      const fd = fromStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const td = toStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!fd || !td) throw new AppError("from and to must be YYYY-MM-DD", 400);
      if (fromStr > toStr) throw new AppError("from must be on or before to", 400);
      const [y1, m1, d1] = fromStr.split("-").map(Number);
      const [y2, m2, d2] = toStr.split("-").map(Number);
      const a = new Date(y1, m1 - 1, d1).getTime();
      const b = new Date(y2, m2 - 1, d2).getTime();
      const inclusiveDays = Math.round((b - a) / 86400000) + 1;
      if (inclusiveDays < 1 || inclusiveDays > 93) {
        throw new AppError("Date range must be between 1 and 93 days", 400);
      }
      const [packet] = await db.execute("CALL construction_spWorkforceScheduleRange(?,?,?,?)", [
        scoped.companyId,
        scoped.branchId,
        fromStr,
        toStr,
      ]);
      const rows = Array.isArray(packet?.[0]) ? packet[0] : [];
      return res.json({ success: true, data: rows });
    }

    const m = String(month || "").trim();
    const match = m.match(/^(\d{4})-(\d{2})$/);
    if (!match) throw new AppError("month must be YYYY-MM, or pass from and to (YYYY-MM-DD)", 400);
    const monthFirst = `${match[1]}-${match[2]}-01`;

    const [packet] = await db.execute("CALL construction_spWorkforceScheduleMonth(?,?,?)", [
      scoped.companyId,
      scoped.branchId,
      monthFirst,
    ]);
    const rows = Array.isArray(packet?.[0]) ? packet[0] : [];
    return res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

