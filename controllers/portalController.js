import { getBusinessTypeIntelligence, getDashboardKpiData, getRoleNavigation } from "../services/portalService.js";

export const getPortalNavigation = async (req, res, next) => {
  try {
    const roleName = req.user?.role;
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
