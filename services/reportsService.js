import db from "../config/db.js";
import { AppError } from "../utils/AppError.js";

const getAccessScope = (user) => {
  if (user.role === "SuperAdmin" || user.role === "Admin") {
    return { companyIds: null, branchIds: null };
  }

  if (user.role === "CompanyAdmin" || user.role === "CompanyManager" || user.role === "Manager" || user.role === "Viewer" || user.role === "Maintenance") {
    return {
      companyIds: user.company_ids || null,
      branchIds: null,
    };
  }

  if (user.role === "BranchManager" || user.role === "Driver") {
    return {
      companyIds: user.company_ids || null,
      branchIds: user.branch_ids || null,
    };
  }

  throw new AppError("Unauthorized role for reports", 403);
};

export const getMonthlyReportData = async ({ user, year, month, businessType }) => {
  const { companyIds, branchIds } = getAccessScope(user);
  const [result] = await db.execute("CALL portal_spReportsMonthly(?,?,?,?,?)", [
    year,
    month,
    businessType || null,
    companyIds,
    branchIds,
  ]);

  return {
    summary: result?.[0]?.[0] || {},
    byBusinessType: result?.[1] || [],
  };
};

export const getAnnualReportData = async ({ user, year, businessType }) => {
  const { companyIds, branchIds } = getAccessScope(user);
  const [result] = await db.execute("CALL portal_spReportsAnnual(?,?,?,?)", [
    year,
    businessType || null,
    companyIds,
    branchIds,
  ]);

  return result?.[0] || [];
};
