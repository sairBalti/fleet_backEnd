import db from "../config/db.js";

export const getCompanyBranchLookup = async (req, res) => {
  try {
    let {
      companyId,
      returnCompanyData,
      returnBranchData
    } = req.body;

    const loggedInUserId = req.user.user_id;

    //  Default behavior (safe)
    returnCompanyData = returnCompanyData === true;
    returnBranchData = returnBranchData === true;

    // If nothing passed → return both
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
      } else if (user?.company_id) {
        const [rows] = await db.execute(
          `SELECT c.company_id AS id, c.company_name AS name, bt.business_type_name
           FROM companies c
           LEFT JOIN lookup_businesstypes bt ON bt.business_type_id = c.business_type_id
           WHERE c.company_id = ?
           ORDER BY c.company_name`,
          [user.company_id]
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
      } else if (role === "BranchManager" || role === "Driver") {
        const [rows] = await db.execute(
          `SELECT b.branch_id AS id, b.branch_name AS name, b.company_id
           FROM branches b
           WHERE b.isDeleted = 0 AND b.branch_id = ?
           ORDER BY b.branch_name`,
          [user.branch_id]
        );
        branchList = rows;
      } else if (user?.company_id) {
        const effectiveCompanyId = companyId || user.company_id;
        if (String(effectiveCompanyId) !== String(user.company_id)) {
          branchList = [];
        } else {
          const [rows] = await db.execute(
            `SELECT b.branch_id AS id, b.branch_name AS name, b.company_id
             FROM branches b
             WHERE b.isDeleted = 0 AND b.company_id = ?
             ORDER BY b.branch_name`,
            [effectiveCompanyId]
          );
          branchList = rows;
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        companyList,
        branchList
      }
    });

  } catch (error) {
    console.error("Lookup Controller Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch lookup data"
    });
  }
};