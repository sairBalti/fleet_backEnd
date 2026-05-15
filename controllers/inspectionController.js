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

const normalizeScope = (access, companyId, branchId) => {
  let cId = companyId != null ? Number(companyId) : null;
  let bId = branchId != null ? Number(branchId) : null;

  if (!ADMIN_ROLES.has(access.role_name)) {
    cId = access.company_id;
    if (BRANCH_SCOPED_ROLES.has(access.role_name)) bId = access.branch_id;
  }
  return { companyId: cId, branchId: bId };
};

async function loadInspectionHeader(inspectionId, companyId) {
  const [rows] = await db.execute(
    `SELECT * FROM construction_inspections WHERE inspection_id = ? AND company_id = ? LIMIT 1`,
    [inspectionId, companyId]
  );
  return rows[0] || null;
}

async function assertInspectionInScope(inspectionId, scope, access) {
  const row = await loadInspectionHeader(inspectionId, scope.companyId);
  if (!row) throw new AppError("Inspection not found", 404);
  if (BRANCH_SCOPED_ROLES.has(access.role_name) && Number(row.branch_id) !== Number(access.branch_id)) {
    throw new AppError("Forbidden", 403);
  }
  if (scope.branchId != null && Number(row.branch_id) !== Number(scope.branchId)) {
    throw new AppError("Inspection not found", 404);
  }
  return row;
}

export const listInspections = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);

    const {
      companyId,
      branchId,
      status = null,
      projectId = null,
      searchText = null,
      pageNumber = 1,
      pageSize = 20,
    } = req.query;

    const scope = normalizeScope(access, companyId, branchId);
    if (!scope.companyId) {
      return res.json({
        success: true,
        data: [],
        pagination: { pageNumber: 1, pageSize: 20, totalRecords: 0 },
      });
    }

    const [result] = await db.execute("CALL construction_spInspectionsList(?,?,?,?,?,?,?)", [
      scope.companyId,
      scope.branchId,
      status || null,
      projectId ? Number(projectId) : null,
      searchText || null,
      Math.max(1, Number(pageNumber) || 1),
      Math.max(1, Math.min(100, Number(pageSize) || 20)),
    ]);

    const total = Number(result?.[0]?.[0]?.totalRecords || 0);
    const rows = result?.[1] || [];
    return res.json({
      success: true,
      data: rows,
      pagination: {
        pageNumber: Math.max(1, Number(pageNumber) || 1),
        pageSize: Math.max(1, Math.min(100, Number(pageSize) || 20)),
        totalRecords: total,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createInspection = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const body = req.body || {};
    const scope = normalizeScope(access, body.company_id, body.branch_id);
    if (!scope.companyId || !scope.branchId) throw new AppError("company_id and branch_id are required", 400);
    if (!body.title || !body.inspection_date) throw new AppError("title and inspection_date are required", 400);

    const [rows] = await db.execute("CALL construction_spInspectionUpsert(?,?,?,?,?,?,?,?,?,?,?,?)", [
      0,
      scope.companyId,
      scope.branchId,
      body.project_id ? Number(body.project_id) : null,
      body.inspection_type || "Site",
      String(body.title).trim(),
      body.inspection_date,
      body.status || "Draft",
      body.overall_result || null,
      body.notes || null,
      body.inspector_user_id ? Number(body.inspector_user_id) : req.user.user_id,
      req.user.user_id,
    ]);
    const inspectionId = Number(rows?.[0]?.[0]?.inspection_id);
    if (!inspectionId) throw new AppError("Could not create inspection", 500);
    return res.json({ success: true, data: { inspection_id: inspectionId } });
  } catch (error) {
    next(error);
  }
};

export const updateInspection = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const inspectionId = Number(req.params.id);
    const body = req.body || {};
    const scope = normalizeScope(access, body.company_id, body.branch_id);
    if (!scope.companyId || !scope.branchId) throw new AppError("company_id and branch_id are required", 400);

    await assertInspectionInScope(inspectionId, scope, access);

    const existing = await loadInspectionHeader(inspectionId, scope.companyId);
    const title = body.title != null ? String(body.title).trim() : existing.title;
    const inspectionDate = body.inspection_date ?? existing.inspection_date;
    const projectId =
      body.project_id !== undefined
        ? body.project_id
          ? Number(body.project_id)
          : null
        : existing.project_id;

    const [rows] = await db.execute("CALL construction_spInspectionUpsert(?,?,?,?,?,?,?,?,?,?,?,?)", [
      inspectionId,
      scope.companyId,
      scope.branchId,
      projectId,
      body.inspection_type || existing.inspection_type || "Site",
      title || "Untitled",
      inspectionDate,
      body.status || existing.status || "Draft",
      body.overall_result !== undefined ? body.overall_result : existing.overall_result,
      body.notes !== undefined ? body.notes : existing.notes,
      body.inspector_user_id != null ? Number(body.inspector_user_id) : existing.inspector_user_id || req.user.user_id,
      req.user.user_id,
    ]);
    const id = Number(rows?.[0]?.[0]?.inspection_id);
    return res.json({ success: true, data: { inspection_id: id } });
  } catch (error) {
    next(error);
  }
};

export const getInspectionDetail = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const inspectionId = Number(req.params.id);
    const scope = normalizeScope(access, req.query.companyId, req.query.branchId);
    if (!scope.companyId) throw new AppError("companyId required", 400);

    const header = await assertInspectionInScope(inspectionId, scope, access);

    const [items] = await db.execute(
      `SELECT * FROM construction_inspection_items WHERE inspection_id = ? ORDER BY sort_order ASC, item_id ASC`,
      [inspectionId]
    );
    const [issues] = await db.execute(
      `SELECT * FROM construction_inspection_issues WHERE inspection_id = ? ORDER BY issue_id DESC`,
      [inspectionId]
    );
    const [images] = await db.execute(
      `SELECT * FROM construction_inspection_images WHERE inspection_id = ? ORDER BY image_id DESC`,
      [inspectionId]
    );

    return res.json({
      success: true,
      data: {
        inspection: header,
        items,
        issues,
        images,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const upsertInspectionItem = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const inspectionId = Number(req.params.id);
    const body = req.body || {};
    const scope = normalizeScope(access, body.company_id, body.branch_id);
    if (!scope.companyId) throw new AppError("company_id required", 400);

    await assertInspectionInScope(inspectionId, scope, access);

    if (!body.category || !body.checklist_label) throw new AppError("category and checklist_label are required", 400);

    const [rows] = await db.execute("CALL construction_spInspectionItemUpsert(?,?,?,?,?,?,?,?)", [
      Number(body.item_id || 0),
      inspectionId,
      scope.companyId,
      String(body.category).trim(),
      String(body.checklist_label).trim(),
      body.sort_order != null ? Number(body.sort_order) : 0,
      body.result || "NA",
      body.comments || null,
    ]);
    const itemId = Number(rows?.[0]?.[0]?.item_id);
    if (!itemId) throw new AppError("Could not save checklist item", 400);
    return res.json({ success: true, data: { item_id: itemId } });
  } catch (error) {
    next(error);
  }
};

export const upsertInspectionIssue = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const inspectionId = Number(req.params.id);
    const body = req.body || {};
    const scope = normalizeScope(access, body.company_id, body.branch_id);
    if (!scope.companyId) throw new AppError("company_id required", 400);

    await assertInspectionInScope(inspectionId, scope, access);

    if (!body.description || !String(body.description).trim()) throw new AppError("description is required", 400);

    const [rows] = await db.execute("CALL construction_spInspectionIssueUpsert(?,?,?,?,?,?,?,?,?)", [
      Number(body.issue_id || 0),
      inspectionId,
      scope.companyId,
      body.item_id ? Number(body.item_id) : null,
      body.severity || "Medium",
      body.defect_type || null,
      String(body.description).trim(),
      body.status || "Open",
      req.user.user_id,
    ]);
    const issueId = Number(rows?.[0]?.[0]?.issue_id);
    if (!issueId) throw new AppError("Could not save issue", 400);
    return res.json({ success: true, data: { issue_id: issueId } });
  } catch (error) {
    next(error);
  }
};

export const patchIssueStatus = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const issueId = Number(req.params.issueId);
    const body = req.body || {};
    const scope = normalizeScope(access, body.company_id, body.branch_id);
    if (!scope.companyId) throw new AppError("company_id required", 400);
    if (!body.status) throw new AppError("status is required", 400);

    const [issueRows] = await db.execute(
      `SELECT iss.issue_id, iss.inspection_id, i.company_id, i.branch_id
       FROM construction_inspection_issues iss
       INNER JOIN construction_inspections i ON i.inspection_id = iss.inspection_id
       WHERE iss.issue_id = ? AND i.company_id = ?`,
      [issueId, scope.companyId]
    );
    if (!issueRows.length) throw new AppError("Issue not found", 404);
    await assertInspectionInScope(issueRows[0].inspection_id, scope, access);

    await db.execute("CALL construction_spInspectionIssueStatus(?,?,?)", [issueId, scope.companyId, body.status]);

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const uploadInspectionImage = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const inspectionId = Number(req.params.id);
    const companyId = Number(req.body.company_id);
    const branchId = Number(req.body.branch_id);
    if (!companyId || !branchId) throw new AppError("company_id and branch_id are required", 400);
    const scope = normalizeScope(access, companyId, branchId);
    if (!scope.companyId) throw new AppError("Invalid scope", 400);

    await assertInspectionInScope(inspectionId, scope, access);

    if (!req.file?.filename) throw new AppError("image file is required", 400);

    const filePath = `/uploads/${req.file.filename}`;
    const caption = req.body.caption || null;
    const issueId = req.body.issue_id ? Number(req.body.issue_id) : null;

    const [rows] = await db.execute("CALL construction_spInspectionImageInsert(?,?,?,?,?,?)", [
      inspectionId,
      scope.companyId,
      issueId || null,
      filePath,
      caption,
      req.user.user_id,
    ]);
    const imageId = Number(rows?.[0]?.[0]?.image_id);
    if (!imageId) throw new AppError("Could not save image metadata", 400);

    const url = filePath;
    return res.json({ success: true, data: { image_id: imageId, file_path: filePath, url } });
  } catch (error) {
    next(error);
  }
};
