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

const mapProject = (payload = {}) => ({
  project_name: String(payload.project_name || "").trim(),
  project_code: String(payload.project_code || "").trim(),
  description: payload.description || null,
  start_date: payload.start_date || null,
  end_date: payload.end_date || null,
  status: payload.status || "Planning",
  priority: payload.priority || "Medium",
});

export const listProjects = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);

    const {
      companyId,
      branchId,
      status = null,
      searchText = null,
      sortColumn = "start_date",
      sortDirection = "DESC",
      pageNumber = 1,
      pageSize = 20,
    } = req.query;

    const scope = normalizeScope(access, companyId, branchId);
    if (!scope.companyId) return res.json({ success: true, data: [], pagination: { pageNumber: 1, pageSize: 20, totalRecords: 0 } });

    const [result] = await db.execute("CALL construction_spProjectsList(?,?,?,?,?,?,?,?)", [
      scope.companyId,
      scope.branchId,
      status,
      searchText,
      sortColumn,
      String(sortDirection).toUpperCase() === "ASC" ? "ASC" : "DESC",
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

export const createProject = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);

    const body = req.body || {};
    const project = mapProject(body);
    const scope = normalizeScope(access, body.company_id, body.branch_id);

    if (!scope.companyId || !scope.branchId) throw new AppError("company_id and branch_id are required", 400);
    if (!project.project_name) throw new AppError("project_name is required", 400);
    if (!project.project_code) throw new AppError("project_code is required", 400);
    if (!project.start_date) throw new AppError("start_date is required", 400);

    const [createResult] = await db.execute("CALL construction_spProjectCreate(?,?,?,?,?,?,?,?,?,?)", [
      scope.companyId,
      scope.branchId,
      project.project_name,
      project.project_code,
      project.description,
      project.start_date,
      project.end_date,
      project.status,
      project.priority,
      req.user.user_id,
    ]);
    const projectId = Number(createResult?.[0]?.[0]?.project_id);
    if (!projectId) throw new AppError("Could not create project", 500);

    const milestones = Array.isArray(body.milestones) ? body.milestones : [];
    const tasks = Array.isArray(body.tasks) ? body.tasks : [];
    const milestoneMap = new Map();
    const taskMap = new Map();

    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (!m?.milestone_name) continue;
      const [r] = await db.execute("CALL construction_spMilestoneUpsert(?,?,?,?,?,?,?)", [
        0,
        projectId,
        String(m.milestone_name).trim(),
        m.due_date || null,
        m.status || "Pending",
        Number(m.sort_order ?? i + 1),
        m.notes || null,
      ]);
      const milestoneId = Number(r?.[0]?.[0]?.milestone_id || 0);
      if (milestoneId && m.temp_key) milestoneMap.set(String(m.temp_key), milestoneId);
    }

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      if (!t?.task_name) continue;
      const milestoneId = t.milestone_temp_key ? milestoneMap.get(String(t.milestone_temp_key)) || null : (t.milestone_id || null);
      const parentTaskId = t.parent_temp_key ? taskMap.get(String(t.parent_temp_key)) || null : (t.parent_task_id || null);
      const [r] = await db.execute("CALL construction_spTaskUpsert(?,?,?,?,?,?,?,?,?,?,?,?)", [
        0,
        projectId,
        milestoneId,
        parentTaskId,
        String(t.task_name).trim(),
        t.description || null,
        t.start_date || null,
        t.due_date || null,
        t.status || "Todo",
        t.priority || "Medium",
        Number(t.progress_percent || 0),
        Number(t.sort_order ?? i + 1),
      ]);
      const taskId = Number(r?.[0]?.[0]?.task_id || 0);
      if (taskId && t.temp_key) taskMap.set(String(t.temp_key), taskId);
    }

    return res.status(201).json({ success: true, message: "Project created", data: { project_id: projectId } });
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const projectId = Number(req.params.id);
    if (!projectId) throw new AppError("Invalid project id", 400);

    const project = mapProject(req.body || {});
    if (!project.project_name) throw new AppError("project_name is required", 400);
    if (!project.start_date) throw new AppError("start_date is required", 400);

    await db.execute("CALL construction_spProjectUpdate(?,?,?,?,?,?,?)", [
      projectId,
      project.project_name,
      project.description,
      project.start_date,
      project.end_date,
      project.priority,
      req.user.user_id,
    ]);

    return res.json({ success: true, message: "Project updated" });
  } catch (error) {
    next(error);
  }
};

export const getProjectDetail = async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    if (!projectId) throw new AppError("Invalid project id", 400);

    const [result] = await db.execute("CALL construction_spProjectDetail(?)", [projectId]);
    const project = result?.[0]?.[0] || null;
    if (!project) throw new AppError("Project not found", 404);
    return res.json({
      success: true,
      data: {
        project,
        milestones: result?.[1] || [],
        tasks: result?.[2] || [],
        assignments: result?.[3] || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

export const assignUser = async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const { user_id, assignment_role } = req.body || {};
    if (!projectId || !user_id || !assignment_role) throw new AppError("project id, user_id, assignment_role required", 400);

    await db.execute("CALL construction_spProjectAssignUser(?,?,?,?)", [
      projectId,
      Number(user_id),
      String(assignment_role).trim(),
      req.user.user_id,
    ]);
    return res.json({ success: true, message: "User assigned to project" });
  } catch (error) {
    next(error);
  }
};

export const changeProjectStatus = async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const { status } = req.body || {};
    if (!projectId || !status) throw new AppError("project id and status required", 400);
    await db.execute("CALL construction_spProjectStatusChange(?,?,?)", [projectId, status, req.user.user_id]);
    return res.json({ success: true, message: "Status updated" });
  } catch (error) {
    next(error);
  }
};

export const upsertMilestone = async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const m = req.body || {};
    if (!projectId || !m.milestone_name) throw new AppError("project id and milestone_name required", 400);
    const [r] = await db.execute("CALL construction_spMilestoneUpsert(?,?,?,?,?,?,?)", [
      Number(m.milestone_id || 0),
      projectId,
      String(m.milestone_name).trim(),
      m.due_date || null,
      m.status || "Pending",
      Number(m.sort_order || 1),
      m.notes || null,
    ]);
    return res.json({ success: true, data: { milestone_id: Number(r?.[0]?.[0]?.milestone_id || 0) } });
  } catch (error) {
    next(error);
  }
};

export const upsertTask = async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    const t = req.body || {};
    if (!projectId || !t.task_name) throw new AppError("project id and task_name required", 400);
    const [r] = await db.execute("CALL construction_spTaskUpsert(?,?,?,?,?,?,?,?,?,?,?,?)", [
      Number(t.task_id || 0),
      projectId,
      t.milestone_id ? Number(t.milestone_id) : null,
      t.parent_task_id ? Number(t.parent_task_id) : null,
      String(t.task_name).trim(),
      t.description || null,
      t.start_date || null,
      t.due_date || null,
      t.status || "Todo",
      t.priority || "Medium",
      Number(t.progress_percent || 0),
      Number(t.sort_order || 1),
    ]);
    return res.json({ success: true, data: { task_id: Number(r?.[0]?.[0]?.task_id || 0) } });
  } catch (error) {
    next(error);
  }
};

export const getProjectDashboard = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const scope = normalizeScope(access, req.query.companyId, req.query.branchId);
    if (!scope.companyId) return res.json({ success: true, data: { summary: {}, delayedProjects: [] } });

    const [result] = await db.execute("CALL construction_spProjectDashboard(?,?)", [scope.companyId, scope.branchId]);
    return res.json({
      success: true,
      data: {
        summary: result?.[0]?.[0] || {},
        delayedProjects: result?.[1] || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listAssignableUsers = async (req, res, next) => {
  try {
    const projectId = Number(req.params.id);
    if (!projectId) throw new AppError("Invalid project id", 400);
    const [projectRows] = await db.execute("SELECT company_id, branch_id FROM projects WHERE project_id = ? LIMIT 1", [projectId]);
    const project = projectRows[0];
    if (!project) throw new AppError("Project not found", 404);

    const [rows] = await db.execute(
      `SELECT u.id AS user_id, CONCAT(u.firstname, ' ', COALESCE(u.lastname, '')) AS user_name, u.email, lr.role_name
       FROM users u
       INNER JOIN lookup_roles lr ON lr.role_id = u.role_id
       WHERE u.company_id = ? AND (u.branch_id = ? OR u.branch_id IS NULL)
       ORDER BY u.firstname`,
      [project.company_id, project.branch_id]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

