import db from "../config/db.js";

const DRIVER_STATUSES = ["Active", "On Leave", "Suspended", "Inactive"];

const resolveUserScope = async (userId) => {
  const [rows] = await db.execute(
    `SELECT u.company_id, u.branch_id, lr.role_name
     FROM users u
     INNER JOIN lookup_roles lr ON lr.role_id = u.role_id
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

const isActiveFromStatus = (status) => (status === "Suspended" || status === "Inactive" ? 0 : 1);

const assertValidStatus = (status) => DRIVER_STATUSES.includes(status);

const canAccessDriverRow = (user, row) => {
  if (!user || !row) return false;
  if (["SuperAdmin", "Admin"].includes(user.role_name)) return true;
  if (row.company_id !== user.company_id) return false;
  if (["BranchManager", "Driver"].includes(user.role_name) && row.branch_id !== user.branch_id) {
    return false;
  }
  return true;
};

export const getDriversList = async (req, res) => {
  try {
    const {
      companyId = null,
      branchId = null,
      status = "All",
      searchText = null,
      sortColumn = "driver_name",
      sortDirection = "ASC",
      pageNumber = 1,
      pageSize = 20,
    } = req.body || {};

    const allowedSort = ["driver_name", "email", "branch_name", "efficiency_score", "driver_status"];
    const vSort = allowedSort.includes(sortColumn) ? sortColumn : "driver_name";
    const vDir = String(sortDirection).toUpperCase() === "DESC" ? "DESC" : "ASC";
    const pn = Math.max(1, Number(pageNumber) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));

    const statusFilter = status && status !== "All" ? status : null;
    const search = searchText && String(searchText).trim() ? String(searchText).trim() : null;

    const [result] = await db.execute(
      "CALL portal_spDriverMainPageData(?,?,?,?,?,?,?,?,?)",
      [
        companyId ? Number(companyId) : null,
        branchId ? Number(branchId) : null,
        statusFilter,
        search,
        vSort,
        vDir,
        pn,
        ps,
        req.user.user_id,
      ]
    );

    const rows = result[0] || [];
    const totalRecords = rows.length ? Number(rows[0].totalRecords || 0) : 0;
    const cleanedRows = rows.map(({ totalRecords: _ignored, ...rest }) => rest);

    return res.json({
      success: true,
      data: cleanedRows,
      pagination: { pageNumber: pn, pageSize: ps, totalRecords },
    });
  } catch (error) {
    console.error("Driver list failed:", error);
    return res.status(500).json({ success: false, message: "Failed to list drivers" });
  }
};

export const getDriverById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await resolveUserScope(req.user.user_id);
    if (!user) return res.status(403).json({ success: false, message: "Forbidden" });

    const [rows] = await db.execute(
      `SELECT
        dp.driver_id,
        dp.company_id,
        dp.branch_id,
        dp.driver_name,
        dp.email,
        dp.total_driving_hours,
        dp.total_mileage,
        dp.efficiency_score,
        dp.safety_score,
        dp.completion_rate,
        dp.driver_status,
        dp.is_active,
        b.branch_name,
        c.company_name
      FROM portal_driver_profiles dp
      INNER JOIN branches b ON b.branch_id = dp.branch_id AND b.isDeleted = 0
      INNER JOIN companies c ON c.company_id = dp.company_id
      WHERE dp.driver_id = ?
      LIMIT 1`,
      [id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ success: false, message: "Driver not found" });
    if (!canAccessDriverRow(user, row)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    return res.json({
      success: true,
      data: {
        id: row.driver_id,
        company_id: row.company_id,
        branch_id: row.branch_id,
        driver_name: row.driver_name,
        email: row.email,
        total_driving_hours: row.total_driving_hours,
        total_mileage: row.total_mileage,
        efficiency_score: row.efficiency_score,
        safety_score: row.safety_score,
        completion_rate: row.completion_rate,
        status: row.driver_status,
        branch_name: row.branch_name,
        company_name: row.company_name,
      },
    });
  } catch (error) {
    console.error("getDriverById failed:", error);
    return res.status(500).json({ success: false, message: "Failed to load driver" });
  }
};

export const createDriver = async (req, res) => {
  try {
    const user = await resolveUserScope(req.user.user_id);
    if (!user) return res.status(403).json({ success: false, message: "Forbidden" });

    let {
      company_id,
      branch_id,
      driver_name,
      email,
      total_driving_hours,
      total_mileage,
      efficiency_score,
      safety_score,
      completion_rate,
      driver_status,
    } = req.body || {};

    if (!driver_name || !String(driver_name).trim()) {
      return res.status(400).json({ success: false, message: "driver_name is required" });
    }

    if (["SuperAdmin", "Admin"].includes(user.role_name)) {
      if (!company_id || !branch_id) {
        return res.status(400).json({ success: false, message: "company_id and branch_id are required" });
      }
    } else {
      company_id = user.company_id;
      if (["BranchManager", "Driver"].includes(user.role_name)) {
        branch_id = user.branch_id;
      }
      if (!branch_id) {
        return res.status(400).json({ success: false, message: "branch_id is required" });
      }
    }

    const status = assertValidStatus(driver_status) ? driver_status : "Active";
    const ia = isActiveFromStatus(status);

    await db.execute(
      `INSERT INTO portal_driver_profiles
      (company_id, branch_id, driver_name, email, total_driving_hours, total_mileage, efficiency_score, safety_score, completion_rate, driver_status, is_active)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        company_id,
        branch_id,
        String(driver_name).trim(),
        email || null,
        total_driving_hours ?? 0,
        total_mileage ?? 0,
        efficiency_score ?? 0,
        safety_score ?? 0,
        completion_rate ?? 0,
        status,
        ia,
      ]
    );

    return res.status(201).json({ success: true, message: "Driver created successfully" });
  } catch (error) {
    console.error("createDriver failed:", error);
    return res.status(500).json({ success: false, message: "Failed to create driver" });
  }
};

export const updateDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await resolveUserScope(req.user.user_id);
    if (!user) return res.status(403).json({ success: false, message: "Forbidden" });

    const [existing] = await db.execute(
      "SELECT driver_id, company_id, branch_id FROM portal_driver_profiles WHERE driver_id = ? LIMIT 1",
      [id]
    );
    const row = existing[0];
    if (!row) return res.status(404).json({ success: false, message: "Driver not found" });
    if (!canAccessDriverRow(user, row)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    let {
      company_id,
      branch_id,
      driver_name,
      email,
      total_driving_hours,
      total_mileage,
      efficiency_score,
      safety_score,
      completion_rate,
      driver_status,
    } = req.body || {};

    if (["SuperAdmin", "Admin"].includes(user.role_name)) {
      if (!company_id || !branch_id) {
        return res.status(400).json({ success: false, message: "company_id and branch_id are required" });
      }
    } else {
      company_id = user.company_id;
      if (["BranchManager", "Driver"].includes(user.role_name)) {
        branch_id = user.branch_id;
      }
    }

    const status = assertValidStatus(driver_status) ? driver_status : undefined;
    if (!driver_name || !String(driver_name).trim()) {
      return res.status(400).json({ success: false, message: "driver_name is required" });
    }

    const nextStatus = status || (await fetchCurrentStatus(id));
    const ia = isActiveFromStatus(nextStatus);

    await db.execute(
      `UPDATE portal_driver_profiles SET
        company_id = ?,
        branch_id = ?,
        driver_name = ?,
        email = ?,
        total_driving_hours = ?,
        total_mileage = ?,
        efficiency_score = ?,
        safety_score = ?,
        completion_rate = ?,
        driver_status = ?,
        is_active = ?
      WHERE driver_id = ?`,
      [
        company_id,
        branch_id,
        String(driver_name).trim(),
        email || null,
        total_driving_hours ?? 0,
        total_mileage ?? 0,
        efficiency_score ?? 0,
        safety_score ?? 0,
        completion_rate ?? 0,
        nextStatus,
        ia,
        id,
      ]
    );

    return res.json({ success: true, message: "Driver updated successfully" });
  } catch (error) {
    console.error("updateDriver failed:", error);
    return res.status(500).json({ success: false, message: "Failed to update driver" });
  }
};

async function fetchCurrentStatus(driverId) {
  const [r] = await db.execute(
    "SELECT driver_status FROM portal_driver_profiles WHERE driver_id = ? LIMIT 1",
    [driverId]
  );
  return r[0]?.driver_status || "Active";
}

export const patchDriverStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status: driver_status } = req.body || {};
    const user = await resolveUserScope(req.user.user_id);
    if (!user) return res.status(403).json({ success: false, message: "Forbidden" });

    if (!assertValidStatus(driver_status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${DRIVER_STATUSES.join(", ")}`,
      });
    }

    const [existing] = await db.execute(
      "SELECT driver_id, company_id, branch_id FROM portal_driver_profiles WHERE driver_id = ? LIMIT 1",
      [id]
    );
    const row = existing[0];
    if (!row) return res.status(404).json({ success: false, message: "Driver not found" });
    if (!canAccessDriverRow(user, row)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const ia = isActiveFromStatus(driver_status);
    await db.execute(
      "UPDATE portal_driver_profiles SET driver_status = ?, is_active = ? WHERE driver_id = ?",
      [driver_status, ia, id]
    );

    return res.json({ success: true, message: "Status updated" });
  } catch (error) {
    console.error("patchDriverStatus failed:", error);
    return res.status(500).json({ success: false, message: "Failed to update status" });
  }
};

export const deleteDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await resolveUserScope(req.user.user_id);
    if (!user) return res.status(403).json({ success: false, message: "Forbidden" });

    const [existing] = await db.execute(
      "SELECT driver_id, company_id, branch_id FROM portal_driver_profiles WHERE driver_id = ? LIMIT 1",
      [id]
    );
    const row = existing[0];
    if (!row) return res.status(404).json({ success: false, message: "Driver not found" });
    if (!canAccessDriverRow(user, row)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await db.execute("DELETE FROM portal_driver_profiles WHERE driver_id = ?", [id]);
    return res.json({ success: true, message: "Driver removed" });
  } catch (error) {
    console.error("deleteDriver failed:", error);
    return res.status(500).json({ success: false, message: "Failed to delete driver" });
  }
};

export const getDriverSchedulePageData = async (req, res) => {
  try {
    const {
      companyId = null,
      branchId = null,
      weekStart = null,
      searchText = null,
      sortColumn = "driver_name",
      sortDirection = "ASC",
      pageNumber = 1,
      pageSize = 20,
    } = req.body || {};

    const [result] = await db.execute(
      "CALL portal_spDriverSchedulePageData(?,?,?,?,?,?,?,?,?)",
      [
        companyId,
        branchId,
        weekStart,
        searchText,
        sortColumn,
        sortDirection,
        Number(pageNumber) || 1,
        Number(pageSize) || 20,
        req.user.user_id,
      ]
    );

    const summary = result[0]?.[0] || {};
    const rows = result[1] || [];
    const dailyBreakdown = result[2] || [];
    const totalRecords = rows.length ? Number(rows[0].totalRecords || 0) : 0;
    const cleanedRows = rows.map(({ totalRecords: _ignored, ...rest }) => rest);

    return res.json({
      success: true,
      data: {
        summary,
        rows: cleanedRows,
        dailyBreakdown,
      },
      pagination: {
        pageNumber: Number(pageNumber) || 1,
        pageSize: Number(pageSize) || 20,
        totalRecords,
      },
    });
  } catch (error) {
    console.error("Driver schedule fetch failed:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch driver schedule data" });
  }
};

export const getDriverPerformancePageData = async (req, res) => {
  try {
    const {
      companyId = null,
      branchId = null,
      driverId = null,
      pageNumber = 1,
      pageSize = 12,
    } = req.query || {};

    const [result] = await db.execute(
      "CALL portal_spDriverPerformancePageData(?,?,?,?,?,?)",
      [
        companyId ? Number(companyId) : null,
        branchId ? Number(branchId) : null,
        driverId ? Number(driverId) : null,
        Number(pageNumber) || 1,
        Number(pageSize) || 12,
        req.user.user_id,
      ]
    );

    const profile = result[0]?.[0] || null;
    const trends = result[1] || [];
    const metrics = result[2] || [];
    const driverOptions = result[3] || [];
    const totalRecords = metrics.length ? Number(metrics[0].totalRecords || 0) : 0;
    const cleanedMetrics = metrics.map(({ totalRecords: _ignored, ...rest }) => rest);

    return res.json({
      success: true,
      data: {
        profile,
        trends,
        metrics: cleanedMetrics,
        driverOptions,
      },
      pagination: {
        pageNumber: Number(pageNumber) || 1,
        pageSize: Number(pageSize) || 12,
        totalRecords,
      },
    });
  } catch (error) {
    console.error("Driver performance fetch failed:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch driver performance data" });
  }
};
