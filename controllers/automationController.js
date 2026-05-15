import { AppError } from "../utils/AppError.js";
import { runConstructionAutomationCycle } from "../services/constructionAutomationService.js";

const ALLOWED_RUN = new Set([
  "SuperAdmin",
  "Admin",
  "CompanyAdmin",
  "ConstructionAdmin",
]);

export const runAutomationNow = async (req, res, next) => {
  try {
    const role = req.user.role;
    if (!ALLOWED_RUN.has(role)) throw new AppError("Forbidden", 403);
    const summary = await runConstructionAutomationCycle();
    return res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};
