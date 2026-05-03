import db from "../config/db.js";
import { AppError } from "../utils/AppError.js";

const resolveAllowedCompanyId = (user, requestedCompanyId = null) => {
  const role = user?.role;

  if (role === "SuperAdmin") {
    if (!requestedCompanyId) {
      throw new AppError("Company ID is required for branch action", 400);
    }
    return Number(requestedCompanyId);
  }

  if (role === "CompanyAdmin" || role === "CompanyManager") {
    const allowedIds = String(user?.company_ids || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (allowedIds.length === 0) {
      throw new AppError("No company is assigned to this user", 403);
    }

    if (requestedCompanyId) {
      const companyIdAsText = String(requestedCompanyId);
      if (!allowedIds.includes(companyIdAsText)) {
        throw new AppError("Unauthorized company access", 403);
      }
      return Number(companyIdAsText);
    }

    return Number(allowedIds[0]);
  }

  throw new AppError("Unauthorized role for branch AI action", 403);
};

const normalize = (value = "") => value.trim().toLowerCase();

const checkBranchExists = async (companyId, branchName) => {
  const [rows] = await db.execute(
    `SELECT branch_id FROM branches
     WHERE company_id = ? AND LOWER(branch_name) = ? LIMIT 1`,
    [companyId, normalize(branchName)]
  );
  return rows[0] || null;
};

const resolveBranchByName = async (companyId, branchName) => {
  const normalized = normalize(branchName);
  if (!normalized) {
    throw new AppError("Branch name is required", 400, null, { field: "branch_name" });
  }

  const [exactRows] = await db.execute(
    `SELECT branch_id, branch_name
     FROM branches
     WHERE company_id = ? AND LOWER(branch_name) = ?
     LIMIT 2`,
    [companyId, normalized]
  );

  if (exactRows.length === 1) {
    return exactRows[0];
  }

  const [likeRows] = await db.execute(
    `SELECT branch_id, branch_name
     FROM branches
     WHERE company_id = ? AND LOWER(branch_name) LIKE CONCAT('%', ?, '%')
     ORDER BY branch_name
     LIMIT 6`,
    [companyId, normalized]
  );

  if (likeRows.length === 0) {
    throw new AppError(`Branch "${branchName}" not found`, 404, null, { field: "branch_name" });
  }

  if (likeRows.length > 1) {
    const suggestions = likeRows.map((row) => row.branch_name).join(", ");
    throw new AppError(
      `Multiple branches matched "${branchName}". Please use a more specific name: ${suggestions}`,
      409,
      "AMBIGUOUS_BRANCH",
      { field: "branch_name" }
    );
  }

  return likeRows[0];
};

export const insertBranch = async ({ user, company_id, branch_name, branch_location }) => {
  if (!branch_name?.trim()) {
    throw new AppError("Branch name is required", 400, null, { field: "branch_name" });
  }

  const companyId = resolveAllowedCompanyId(user, company_id);
  const existing = await checkBranchExists(companyId, branch_name);
  if (existing) {
    throw new AppError(`Branch "${branch_name}" already exists`, 409, null, { field: "branch_name" });
  }

  await db.execute(
    "INSERT INTO branches (company_id, branch_name, branch_location, isDeleted) VALUES (?, ?, ?, 0)",
    [companyId, branch_name.trim(), branch_location?.trim() || null]
  );

  return { success: true, company_id: companyId, branch_name: branch_name.trim() };
};

export const updateBranch = async ({ user, company_id, branch_name, updates = {} }) => {
  if (!branch_name?.trim()) {
    throw new AppError("Branch name is required", 400, null, { field: "branch_name" });
  }

  if (!updates.branch_location?.trim()) {
    throw new AppError("Branch location is required for update", 400, null, { field: "branch_location" });
  }

  const companyId = resolveAllowedCompanyId(user, company_id);
  const branch = await resolveBranchByName(companyId, branch_name);

  const [result] = await db.execute(
    `UPDATE branches
     SET branch_location = ?
     WHERE branch_id = ?`,
    [updates.branch_location.trim(), branch.branch_id]
  );

  if (result.affectedRows === 0) {
    throw new AppError("Branch not found", 404);
  }

  return { success: true, message: "Branch updated successfully" };
};

export const changeBranchStatus = async ({ user, company_id, branch_name }, isDeletedValue) => {
  if (!branch_name?.trim()) {
    throw new AppError("Branch name is required", 400, null, { field: "branch_name" });
  }

  const companyId = resolveAllowedCompanyId(user, company_id);
  const branch = await resolveBranchByName(companyId, branch_name);

  const [result] = await db.execute(
    `UPDATE branches
     SET isDeleted = ?
     WHERE branch_id = ?`,
    [isDeletedValue, branch.branch_id]
  );

  if (result.affectedRows === 0) {
    throw new AppError("Branch not found", 404);
  }

  return {
    success: true,
    message: `Branch ${isDeletedValue === 0 ? "activated" : "deactivated"} successfully`,
  };
};
