import db from "../config/db.js";

function parseIdList(csv) {
  if (csv == null || csv === "") return [];
  return String(csv)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "" && !Number.isNaN(Number(s)));
}

export const getCompanyBranchLookup = async (req, res) => {
  try {
    let { companyId, returnCompanyData, returnBranchData } = req.body;

    const loggedInUserId = req.user.user_id;

    returnCompanyData = returnCompanyData === true;
    returnBranchData = returnBranchData === true;

    if (!returnCompanyData && !returnBranchData) {
      returnCompanyData = true;
      returnBranchData = true;
    }

    const [users] = await db.execute(
      `SELECT u.company_id, u.branch_id, lr.role_name
       FROM users u
       INNER JOIN lookup_roles lr ON lr.role_id = u.role_id
       WHERE u.id = ? LIMIT 1`,
      [loggedInUserId]
    );
    const user = users[0];
    const role = user?.role_name;

    /** JWT mirrors login payload; company list must not rely on DB company_id alone (often null for some roles). */
    const jwtCompanyIds = parseIdList(req.user.company_ids);
    const jwtBranchIds = parseIdList(req.user.branch_ids);
    const dbCompanyIds =
      user?.company_id != null && user.company_id !== "" ? [String(Number(user.company_id))] : [];
    const allowedCompanyIds = [...new Set([...jwtCompanyIds.map(String), ...dbCompanyIds.map(String)])].filter(Boolean);

    let companyList = [];
    let branchList = [];

    if (returnCompanyData) {
      if (role === "SuperAdmin" || role === "Admin") {
        const [rows] = await db.execute(
          `SELECT c.company_id AS id, c.company_name AS name, bt.business_type_name
           FROM companies c
           LEFT JOIN lookup_businesstypes bt ON bt.business_type_id = c.business_type_id
           ORDER BY c.company_name`
        );
        companyList = rows;
      } else if (allowedCompanyIds.length > 0) {
        const placeholders = allowedCompanyIds.map(() => "?").join(",");
        const [rows] = await db.execute(
          `SELECT c.company_id AS id, c.company_name AS name, bt.business_type_name
           FROM companies c
           LEFT JOIN lookup_businesstypes bt ON bt.business_type_id = c.business_type_id
           WHERE c.company_id IN (${placeholders})
           ORDER BY c.company_name`,
          allowedCompanyIds.map((id) => Number(id))
        );
        companyList = rows;
      }
    }

    if (returnBranchData) {
      if (role === "SuperAdmin" || role === "Admin") {
        if (companyId) {
          const [rows] = await db.execute(
            `SELECT b.branch_id AS id, b.branch_name AS name, b.company_id
             FROM branches b
             WHERE b.isDeleted = 0 AND b.company_id = ?
             ORDER BY b.branch_name`,
            [companyId]
          );
          branchList = rows;
        } else {
          const [rows] = await db.execute(
            `SELECT b.branch_id AS id, b.branch_name AS name, b.company_id
             FROM branches b
             WHERE b.isDeleted = 0
             ORDER BY b.branch_name`
          );
          branchList = rows;
        }
      } else if (
        ["BranchManager", "Driver", "Supervisor", "Worker", "Contractor", "Maintenance"].includes(role)
      ) {
        const branchKey =
          user?.branch_id != null && user.branch_id !== ""
            ? user.branch_id
            : jwtBranchIds[0] != null
              ? Number(jwtBranchIds[0])
              : null;
        if (branchKey != null) {
          const [rows] = await db.execute(
            `SELECT b.branch_id AS id, b.branch_name AS name, b.company_id
             FROM branches b
             WHERE b.isDeleted = 0 AND b.branch_id = ?
             ORDER BY b.branch_name`,
            [branchKey]
          );
          branchList = rows;
        }
      } else if (allowedCompanyIds.length > 0) {
        const effectiveCompanyId =
          companyId != null && companyId !== "" ? String(companyId) : null;
        if (effectiveCompanyId && !allowedCompanyIds.map(String).includes(effectiveCompanyId)) {
          branchList = [];
        } else {
          const companyFilter = effectiveCompanyId ? [effectiveCompanyId] : allowedCompanyIds.map(String);
          const placeholders = companyFilter.map(() => "?").join(",");
          const [rows] = await db.execute(
            `SELECT b.branch_id AS id, b.branch_name AS name, b.company_id
             FROM branches b
             WHERE b.isDeleted = 0 AND b.company_id IN (${placeholders})
             ORDER BY b.company_id, b.branch_name`,
            companyFilter.map((id) => Number(id))
          );
          branchList = rows;
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        companyList,
        branchList,
      },
    });
  } catch (error) {
    console.error("Lookup Controller Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch lookup data",
    });
  }
};
