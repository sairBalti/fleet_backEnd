import { AppError } from "../utils/AppError.js";
import { orchestrateBranchAI } from "../ai-agent/branchOrchestrator.js";

export const handleAIBranchIngest = async (req, res, next) => {
  try {
    const { message, action, company_id, branch_name, branch_location } = req.body;
    const file = req.file;

    if (branch_name) {
      const result = await orchestrateBranchAI({
        message: null,
        user: req.user,
        directData: {
          action,
          company_id: company_id ? Number(company_id) : null,
          branch_name,
          branch_location,
          updates: branch_location ? { branch_location } : {},
        },
      });

      return res.json({ success: true, data: result });
    }

    if (!message && !file) {
      throw new AppError("Message or file is required", 400);
    }

    const result = await orchestrateBranchAI({
      message,
      file,
      preview: false,
      user: req.user,
      company_id: company_id ? Number(company_id) : null,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

export const previewAIBranch = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) {
      throw new AppError("Message is required", 400);
    }

    const preview = await orchestrateBranchAI({
      message,
      preview: true,
      user: req.user,
    });

    return res.json({ success: true, preview });
  } catch (error) {
    return next(error);
  }
};
