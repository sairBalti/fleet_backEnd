import { getAnnualReportData, getMonthlyReportData } from "../services/reportsService.js";

export const getMonthlyReports = async (req, res, next) => {
  try {
    const now = new Date();
    const year = Number(req.query.year || now.getFullYear());
    const month = Number(req.query.month || now.getMonth() + 1);
    const businessType = req.query.businessType || null;

    const data = await getMonthlyReportData({
      user: req.user,
      year,
      month,
      businessType,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const getAnnualReports = async (req, res, next) => {
  try {
    const now = new Date();
    const year = Number(req.query.year || now.getFullYear());
    const businessType = req.query.businessType || null;

    const data = await getAnnualReportData({
      user: req.user,
      year,
      businessType,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
