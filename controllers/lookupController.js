
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

    const params = [
      companyId || null,
      returnCompanyData,
      returnBranchData,
      loggedInUserId
    ];

    console.log("Lookup SP params:", params);

    const [result] = await db.execute(
      "CALL GetCompanyBranchLookup(?,?,?,?)",
      params
    );

    let companyList = [];
    let branchList = [];

    //  MySQL returns multiple result sets in order
    let index = 0;

    if (returnCompanyData) {
      companyList = result[index] || [];
      index++;
    }

    if (returnBranchData) {
      branchList = result[index] || [];
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