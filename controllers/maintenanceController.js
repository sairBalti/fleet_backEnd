import db from "../config/db.js";
import { AppError } from "../utils/AppError.js";

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

const ALLOWED_PRIORITY = new Set(["Low", "Medium", "High", "Critical"]);
const ALLOWED_STATUS = new Set(["Open", "In Progress", "Completed", "Cancelled"]);

const scopeFilters = (access, queryCompanyId, queryBranchId) => {
  let companyId = queryCompanyId != null ? Number(queryCompanyId) : null;
  let branchId = queryBranchId != null ? Number(queryBranchId) : null;

  if (!["SuperAdmin", "Admin"].includes(access.role_name)) {
    companyId = access.company_id;
    if (["BranchManager", "Driver", "Maintenance"].includes(access.role_name)) {
      branchId = access.branch_id;
    }
  }
  return { companyId, branchId };
};

export const listMaintenanceWorkOrders = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);

    const {
      companyId: qCo,
      branchId: qBr,
      status = null,
      searchText = null,
      sortColumn = "due_date",
      sortDirection = "ASC",
      pageNumber = 1,
      pageSize = 20,
    } = req.query;

    const { companyId, branchId } = scopeFilters(access, qCo, qBr);
    if (!companyId || !branchId) {
      return res.json({
        success: true,
        data: [],
        pagination: { pageNumber: 1, pageSize: 20, totalRecords: 0 },
      });
    }

    const pn = Math.max(1, Number(pageNumber) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const offset = (pn - 1) * ps;

    const allowedSort = {
      due_date: "w.due_date",
      priority: "w.priority",
      status: "w.status",
      registration: "v.registration",
      title: "w.title",
      created_at: "w.created_at",
    };
    const orderCol = allowedSort[sortColumn] || "w.due_date";
    const orderDir = String(sortDirection).toUpperCase() === "DESC" ? "DESC" : "ASC";

    const conditions = ["w.company_id = ?", "w.branch_id = ?"];
    const params = [companyId, branchId];

    if (status && status !== "All") {
      conditions.push("w.status = ?");
      params.push(status);
    }
    if (searchText && String(searchText).trim()) {
      const st = `%${String(searchText).trim()}%`;
      conditions.push("(w.title LIKE ? OR w.description LIKE ? OR v.registration LIKE ?)");
      params.push(st, st, st);
    }

    const whereSql = conditions.join(" AND ");

    const countSql = `
      SELECT COUNT(*) AS total
      FROM portal_maintenance_work_orders w
      INNER JOIN vehicles v ON v.id = w.vehicle_id
      WHERE ${whereSql}
    `;
    const dataSql = `
      SELECT
        w.work_order_id AS id,
        w.company_id,
        w.branch_id,
        w.vehicle_id,
        v.registration,
        v.manufacturer,
        v.model,
        w.title,
        w.description,
        w.priority,
        w.status,
        w.due_date,
        w.completed_at,
        w.created_at
      FROM portal_maintenance_work_orders w
      INNER JOIN vehicles v ON v.id = w.vehicle_id
      WHERE ${whereSql}
      ORDER BY ${orderCol} ${orderDir}
      LIMIT ? OFFSET ?
    `;

    const [[countRow]] = await db.execute(countSql, params);
    const totalRecords = Number(countRow?.total || 0);
    const [rows] = await db.execute(dataSql, [...params, ps, offset]);

    return res.json({
      success: true,
      data: rows,
      pagination: { pageNumber: pn, pageSize: ps, totalRecords },
    });
  } catch (e) {
    next(e);
  }
};

export const getMaintenanceVehicleOptions = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);

    const { companyId: qCo, branchId: qBr } = req.query;
    const { companyId, branchId } = scopeFilters(access, qCo, qBr);
    if (!companyId || !branchId) {
      return res.json({ success: true, data: [] });
    }

    const [rows] = await db.execute(
      `SELECT v.id, v.registration, v.manufacturer, v.model
       FROM vehicles v
       WHERE v.company_id = ? AND v.branch_id = ?
       ORDER BY v.registration ASC
       LIMIT 500`,
      [companyId, branchId]
    );

    return res.json({ success: true, data: rows });
  } catch (e) {
    next(e);
  }
};

export const getWorkOrderById = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);

    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT
        w.work_order_id AS id,
        w.company_id,
        w.branch_id,
        w.vehicle_id,
        v.registration,
        w.title,
        w.description,
        w.priority,
        w.status,
        w.due_date,
        w.completed_at,
        w.created_at
      FROM portal_maintenance_work_orders w
      INNER JOIN vehicles v ON v.id = w.vehicle_id
      WHERE w.work_order_id = ?
      LIMIT 1`,
      [id]
    );
    const row = rows[0];
    if (!row) throw new AppError("Work order not found", 404);

    const { companyId, branchId } = scopeFilters(access, null, null);
    if (!["SuperAdmin", "Admin"].includes(access.role_name)) {
      if (row.company_id !== companyId) throw new AppError("Forbidden", 403);
      if (
        ["BranchManager", "Driver", "Maintenance"].includes(access.role_name) &&
        row.branch_id !== branchId
      ) {
        throw new AppError("Forbidden", 403);
      }
    }

    return res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
};

const assertVehicleInScope = async (vehicleId, companyId, branchId) => {
  const [r] = await db.execute(
    `SELECT id FROM vehicles WHERE id = ? AND company_id = ? AND branch_id = ? LIMIT 1`,
    [vehicleId, companyId, branchId]
  );
  if (!r.length) throw new AppError("Vehicle not found in selected business/branch", 400);
};

export const createWorkOrder = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);

    let {
      company_id,
      branch_id,
      vehicle_id,
      title,
      description,
      priority,
      status,
      due_date,
    } = req.body || {};

    if (["SuperAdmin", "Admin"].includes(access.role_name)) {
      if (!company_id || !branch_id) throw new AppError("company_id and branch_id required", 400);
    } else {
      company_id = access.company_id;
      if (["BranchManager", "Driver", "Maintenance"].includes(access.role_name)) {
        branch_id = access.branch_id;
      }
    }

    if (!company_id || !branch_id) {
      throw new AppError("company_id and branch_id are required", 400);
    }

    if (!vehicle_id || !title) throw new AppError("vehicle_id and title are required", 400);

    const pr = ALLOWED_PRIORITY.has(priority) ? priority : "Medium";
    const st = ALLOWED_STATUS.has(status) ? status : "Open";

    await assertVehicleInScope(Number(vehicle_id), company_id, branch_id);

    await db.execute(
      `INSERT INTO portal_maintenance_work_orders
      (company_id, branch_id, vehicle_id, title, description, priority, status, due_date, created_by)
      VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        company_id,
        branch_id,
        Number(vehicle_id),
        String(title).slice(0, 200),
        description || null,
        pr,
        st,
        due_date || null,
        req.user.user_id || null,
      ]
    );

    return res.status(201).json({ success: true, message: "Work order created" });
  } catch (e) {
    next(e);
  }
};

export const updateWorkOrder = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);

    const { id } = req.params;
    const [existing] = await db.execute(
      "SELECT * FROM portal_maintenance_work_orders WHERE work_order_id = ? LIMIT 1",
      [id]
    );
    const wo = existing[0];
    if (!wo) throw new AppError("Work order not found", 404);

    const { companyId, branchId } = scopeFilters(access, null, null);
    if (!["SuperAdmin", "Admin"].includes(access.role_name)) {
      if (wo.company_id !== companyId) throw new AppError("Forbidden", 403);
      if (
        ["BranchManager", "Driver", "Maintenance"].includes(access.role_name) &&
        wo.branch_id !== branchId
      ) {
        throw new AppError("Forbidden", 403);
      }
    }

    const {
      vehicle_id,
      title,
      description,
      priority,
      status,
      due_date,
    } = req.body || {};

    const nextVehicleId =
      vehicle_id != null ? Number(vehicle_id) : Number(wo.vehicle_id);
    await assertVehicleInScope(nextVehicleId, wo.company_id, wo.branch_id);

    const nextTitle = title != null ? String(title).slice(0, 200) : wo.title;
    const nextDesc = description !== undefined ? description : wo.description;
    const nextPr =
      priority != null && ALLOWED_PRIORITY.has(priority) ? priority : wo.priority;
    const nextSt = status != null && ALLOWED_STATUS.has(status) ? status : wo.status;
    const nextDue = due_date !== undefined ? due_date || null : wo.due_date;

    let nextCompleted = wo.completed_at;
    if (status != null && ALLOWED_STATUS.has(status)) {
      if (status === "Completed") {
        nextCompleted = new Date();
      } else {
        nextCompleted = null;
      }
    }

    await db.execute(
      `UPDATE portal_maintenance_work_orders SET
        vehicle_id = ?,
        title = ?,
        description = ?,
        priority = ?,
        status = ?,
        due_date = ?,
        completed_at = ?
      WHERE work_order_id = ?`,
      [
        nextVehicleId,
        nextTitle,
        nextDesc,
        nextPr,
        nextSt,
        nextDue,
        nextCompleted,
        id,
      ]
    );

    return res.json({ success: true, message: "Work order updated" });
  } catch (e) {
    next(e);
  }
};

export const patchWorkOrderStatus = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);

    const { id } = req.params;
    const { status } = req.body || {};
    if (!ALLOWED_STATUS.has(status)) {
      throw new AppError("Invalid status", 400);
    }

    const [existing] = await db.execute(
      "SELECT company_id, branch_id FROM portal_maintenance_work_orders WHERE work_order_id = ? LIMIT 1",
      [id]
    );
    const wo = existing[0];
    if (!wo) throw new AppError("Work order not found", 404);

    const { companyId, branchId } = scopeFilters(access, null, null);
    if (!["SuperAdmin", "Admin"].includes(access.role_name)) {
      if (wo.company_id !== companyId) throw new AppError("Forbidden", 403);
      if (
        ["BranchManager", "Driver", "Maintenance"].includes(access.role_name) &&
        wo.branch_id !== branchId
      ) {
        throw new AppError("Forbidden", 403);
      }
    }

    await db.execute(
      `UPDATE portal_maintenance_work_orders
       SET status = ?, completed_at = IF(? = 'Completed', NOW(), NULL)
       WHERE work_order_id = ?`,
      [status, status, id]
    );

    return res.json({ success: true, message: "Status updated" });
  } catch (e) {
    next(e);
  }
};

/** Legacy stub for /protected route */
export const update = (req, res) => {
  res.status(200).json({ message: "Maintenance updated successfully" });
};
