import db from "../config/db.js";
import { AppError } from "../utils/AppError.js";

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

export const getReportingSummary = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const scoped = scope(access, req.query.companyId, req.query.branchId);
    if (!scoped.companyId) {
      return res.json({
        success: true,
        data: {
          projects: { summary: {}, delayedProjects: [] },
          workforce: { summary: {}, trend: [] },
          finance: { kpi: {}, budgetLines: [] },
          inspections: { byStatus: [] },
          inventory: { sku_count: 0, inventory_value: 0 },
          equipment: { note: "Equipment utilization will integrate with the Equipment module." },
        },
      });
    }

    const [projResult] = await db.execute("CALL construction_spProjectDashboard(?,?)", [
      scoped.companyId,
      scoped.branchId,
    ]);
    const projectSummary = projResult?.[0]?.[0] || {};
    const delayedProjects = projResult?.[1] || [];

    const [wfResult] = await db.execute("CALL construction_spWorkforceAnalytics(?,?,?)", [
      scoped.companyId,
      scoped.branchId,
      null,
    ]);
    const wfSummary = wfResult?.[0]?.[0] || {};
    const wfTrend = wfResult?.[1] || [];

    const [finResult] = await db.execute("CALL construction_spFinanceKpis(?,?)", [
      scoped.companyId,
      scoped.branchId,
    ]);
    const financeKpi = finResult?.[0]?.[0] || {};
    const budgetLines = finResult?.[1] || [];

    let inspSql = `SELECT status, COUNT(*) AS cnt FROM construction_inspections WHERE company_id = ?`;
    const inspParams = [scoped.companyId];
    if (scoped.branchId != null) {
      inspSql += ` AND branch_id = ?`;
      inspParams.push(scoped.branchId);
    }
    inspSql += ` GROUP BY status`;
    const [inspCounts] = await db.execute(inspSql, inspParams);

    let invSql = `
      SELECT
        COUNT(DISTINCT m.material_id) AS sku_count,
        COALESCE(SUM(IFNULL(i.quantity_on_hand, 0) * IFNULL(i.avg_unit_cost, m.unit_cost)), 0) AS inventory_value
      FROM materials m
      LEFT JOIN inventory i
        ON i.company_id = m.company_id AND i.branch_id = m.branch_id AND i.material_id = m.material_id
      WHERE m.company_id = ? AND m.is_active = 1`;
    const invParams = [scoped.companyId];
    if (scoped.branchId != null) {
      invSql += ` AND m.branch_id = ?`;
      invParams.push(scoped.branchId);
    }
    const [invSnap] = await db.execute(invSql, invParams);

    return res.json({
      success: true,
      data: {
        projects: { summary: projectSummary, delayedProjects },
        workforce: { summary: wfSummary, trend: wfTrend },
        finance: { kpi: financeKpi, budgetLines },
        inspections: { byStatus: inspCounts },
        inventory: invSnap[0] || { sku_count: 0, inventory_value: 0 },
        equipment: {
          note:
            "Fleet/equipment runtime analytics will link here; materials inventory value is shown as a supply-chain proxy.",
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
