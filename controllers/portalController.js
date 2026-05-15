import {
  getAvailableBusinessTypesForUser,
  getBusinessTypeIntelligence,
  getConstructionNavigation,
  getDashboardKpiData,
  getRoleNavigation,
  getUserBusinessType,
} from "../services/portalService.js";

export const getPortalNavigation = async (req, res, next) => {
  try {
    const roleName = req.user?.role;
    const userId = req.user?.user_id;
    const requestedType = String(req.query?.businessType || "").trim();
    const roleCanSwitchBusinessType = ["SuperAdmin", "Admin"].includes(roleName);
    let businessType = await getUserBusinessType(userId);
    if (roleCanSwitchBusinessType) {
      const allowedTypes = await getAvailableBusinessTypesForUser({ userId, roleName });
      if (requestedType && allowedTypes.includes(requestedType)) {
        businessType = requestedType;
      } else if (allowedTypes.length > 0 && (!businessType || !allowedTypes.includes(businessType))) {
        businessType = allowedTypes[0];
      }
    }
    const normalizedBusinessType = String(businessType || "").toLowerCase();
    const isConstructionBusiness = normalizedBusinessType.includes("construction");

    if (isConstructionBusiness) {
      return res.status(200).json({
        success: true,
        data: getConstructionNavigation(roleName),
        selectedBusinessType: businessType,
      });
    }

    const flatRows = await getRoleNavigation(roleName);

    const moduleMap = new Map();
    flatRows.forEach((row) => {
      if (!moduleMap.has(row.module_title)) {
        moduleMap.set(row.module_title, {
          title: row.module_title,
          iconKey: row.icon_key,
          submodules: [],
        });
      }

      const moduleEntry = moduleMap.get(row.module_title);
      if (row.submodule_name && row.path) {
        moduleEntry.submodules.push({
          name: row.submodule_name,
          path: row.path,
        });
      }
    });

    return res.status(200).json({
      success: true,
      data: Array.from(moduleMap.values()),
      selectedBusinessType: businessType || null,
    });
  } catch (error) {
    return next(error);
  }
};

export const getPortalBusinessTypes = async (req, res, next) => {
  try {
    const roleName = req.user?.role;
    const userId = req.user?.user_id;
    const types = await getAvailableBusinessTypesForUser({ userId, roleName });
    return res.status(200).json({
      success: true,
      data: types,
    });
  } catch (error) {
    return next(error);
  }
};

export const getPortalIntelligence = async (req, res, next) => {
  try {
    const { businessType } = req.query;
    const data = await getBusinessTypeIntelligence(businessType);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const getDashboardKpis = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.query;
    const data = await getDashboardKpiData({
      companyId: companyId ? Number(companyId) : null,
      branchId: branchId ? Number(branchId) : null,
      userId: req.user.user_id,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
