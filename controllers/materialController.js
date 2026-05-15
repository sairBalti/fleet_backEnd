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

export const listSuppliers = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const scoped = scope(access, req.query.companyId, req.query.branchId);
    if (!scoped.companyId) return res.json({ success: true, data: [] });
    const [result] = await db.execute("CALL construction_spSuppliersList(?,?,?)", [
      scoped.companyId,
      scoped.branchId,
      req.query.searchText || null,
    ]);
    return res.json({ success: true, data: result?.[0] || [] });
  } catch (error) {
    next(error);
  }
};

export const upsertSupplier = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const body = req.body || {};
    const scoped = scope(access, body.company_id, body.branch_id);
    if (!scoped.companyId || !scoped.branchId) throw new AppError("company_id and branch_id required", 400);
    if (!body.supplier_name) throw new AppError("supplier_name is required", 400);
    const [result] = await db.execute("CALL construction_spSupplierUpsert(?,?,?,?,?,?,?,?)", [
      Number(body.supplier_id || 0),
      scoped.companyId,
      scoped.branchId,
      String(body.supplier_name).trim(),
      body.contact_person || null,
      body.phone || null,
      body.email || null,
      body.is_active == null ? 1 : Number(body.is_active),
    ]);
    return res.json({ success: true, data: { supplier_id: Number(result?.[0]?.[0]?.supplier_id || 0) } });
  } catch (error) {
    next(error);
  }
};

export const upsertMaterial = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const body = req.body || {};
    const scoped = scope(access, body.company_id, body.branch_id);
    if (!scoped.companyId || !scoped.branchId) throw new AppError("company_id and branch_id required", 400);
    if (!body.material_code || !body.material_name) throw new AppError("material_code and material_name required", 400);
    const [result] = await db.execute("CALL construction_spMaterialUpsert(?,?,?,?,?,?,?,?,?,?,?)", [
      Number(body.material_id || 0),
      scoped.companyId,
      scoped.branchId,
      String(body.material_code).trim(),
      String(body.material_name).trim(),
      body.category || null,
      body.unit || "pcs",
      Number(body.min_stock_qty || 0),
      Number(body.unit_cost || 0),
      body.supplier_id ? Number(body.supplier_id) : null,
      body.is_active == null ? 1 : Number(body.is_active),
    ]);
    return res.json({ success: true, data: { material_id: Number(result?.[0]?.[0]?.material_id || 0) } });
  } catch (error) {
    next(error);
  }
};

export const listInventory = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const scoped = scope(access, req.query.companyId, req.query.branchId);
    if (!scoped.companyId) return res.json({ success: true, data: [], lowStockCount: 0, totalStockValue: 0 });
    const [result] = await db.execute("CALL construction_spInventoryList(?,?,?)", [
      scoped.companyId,
      scoped.branchId,
      req.query.searchText || null,
    ]);
    const rows = result?.[0] || [];
    const lowStockCount = rows.filter((r) => Number(r.low_stock) === 1).length;
    const totalStockValue = rows.reduce((sum, r) => sum + Number(r.stock_value || 0), 0);
    return res.json({ success: true, data: rows, lowStockCount, totalStockValue });
  } catch (error) {
    next(error);
  }
};

export const adjustInventory = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const body = req.body || {};
    const scoped = scope(access, body.company_id, body.branch_id);
    if (!scoped.companyId || !scoped.branchId) throw new AppError("company_id and branch_id required", 400);
    if (!body.material_id) throw new AppError("material_id is required", 400);
    const [result] = await db.execute("CALL construction_spInventoryAdjust(?,?,?,?,?)", [
      scoped.companyId,
      scoped.branchId,
      Number(body.material_id),
      Number(body.delta_qty || 0),
      body.unit_cost == null || body.unit_cost === "" ? null : Number(body.unit_cost),
    ]);
    return res.json({ success: true, data: result?.[0]?.[0] || {} });
  } catch (error) {
    next(error);
  }
};

export const logMaterialUsage = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const body = req.body || {};
    const scoped = scope(access, body.company_id, body.branch_id);
    if (!scoped.companyId || !scoped.branchId) throw new AppError("company_id and branch_id required", 400);
    if (!body.material_id || !body.quantity_used || !body.usage_date) {
      throw new AppError("material_id, quantity_used, usage_date required", 400);
    }
    const [result] = await db.execute("CALL construction_spMaterialUsageLog(?,?,?,?,?,?,?,?)", [
      scoped.companyId,
      scoped.branchId,
      body.project_id ? Number(body.project_id) : null,
      Number(body.material_id),
      Number(body.quantity_used),
      body.usage_date,
      body.notes || null,
      req.user.user_id,
    ]);
    return res.json({ success: true, data: { usage_id: Number(result?.[1]?.[0]?.usage_id || result?.[0]?.[0]?.usage_id || 0) } });
  } catch (error) {
    next(error);
  }
};

export const createPurchaseOrder = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const body = req.body || {};
    const scoped = scope(access, body.company_id, body.branch_id);
    if (!scoped.companyId || !scoped.branchId) throw new AppError("company_id and branch_id required", 400);
    if (!body.po_number || !body.material_id || !body.quantity || !body.unit_cost) {
      throw new AppError("po_number, material_id, quantity, unit_cost required", 400);
    }
    const [result] = await db.execute("CALL construction_spPurchaseOrderCreate(?,?,?,?,?,?,?,?,?,?,?)", [
      scoped.companyId,
      scoped.branchId,
      body.supplier_id ? Number(body.supplier_id) : null,
      String(body.po_number).trim(),
      body.order_date || new Date().toISOString().slice(0, 10),
      body.expected_date || null,
      body.notes || null,
      Number(body.material_id),
      Number(body.quantity),
      Number(body.unit_cost),
      req.user.user_id,
    ]);
    return res.json({ success: true, data: { po_id: Number(result?.[0]?.[0]?.po_id || 0) } });
  } catch (error) {
    next(error);
  }
};

export const listPurchaseOrders = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const scoped = scope(access, req.query.companyId, req.query.branchId);
    if (!scoped.companyId) return res.json({ success: true, data: [] });
    const [result] = await db.execute("CALL construction_spPurchaseOrdersList(?,?,?)", [
      scoped.companyId,
      scoped.branchId,
      req.query.status || null,
    ]);
    return res.json({ success: true, data: result?.[0] || [] });
  } catch (error) {
    next(error);
  }
};

export const autoGenerateLowStockDraftPo = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const body = req.body || {};
    const scoped = scope(access, body.company_id, body.branch_id);
    if (!scoped.companyId) throw new AppError("company_id required", 400);
    await db.execute("CALL construction_spAutoLowStockDraftPo(?,?,?)", [
      scoped.companyId,
      scoped.branchId,
      req.user.user_id,
    ]);
    return res.json({ success: true, message: "Low stock draft PO generation completed" });
  } catch (error) {
    next(error);
  }
};

