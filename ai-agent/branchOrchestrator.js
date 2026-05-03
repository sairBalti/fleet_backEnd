import { AppError } from "../utils/AppError.js";
import { parseBranchCommand } from "./branchParser.js";
import { executeBranchAction } from "./branchActionExecutor.js";
import { parseBranchFile } from "./branchFileParser.js";

export const orchestrateBranchAI = async ({
  message,
  file = null,
  preview = false,
  directData = null,
  user,
  company_id = null,
}) => {
  if (directData) {
    return executeBranchAction({
      type: "SINGLE",
      action: directData.action || "CREATE_BRANCH",
      user,
      ...directData,
    });
  }

  let fileData = null;
  let commandData = null;

  if (file) {
    fileData = await parseBranchFile(file);
    if (fileData.errors.length > 0) {
      throw new AppError("File validation failed", 400, "FILE_VALIDATION_ERROR", {
        details: fileData.errors,
      });
    }
  }

  if (message?.trim()) {
    commandData = await parseBranchCommand(message);
    if (commandData?.needsClarification) {
      throw new AppError(commandData.clarificationQuestion || "Please clarify your branch command", 400, "NEEDS_CLARIFICATION");
    }
  }

  if (!fileData && !commandData) {
    throw new AppError("No input provided", 400);
  }

  if (fileData?.branches?.length) {
    return executeBranchAction({
      type: "BULK",
      user,
      company_id: company_id ? Number(company_id) : null,
      branches: fileData.branches,
    });
  }

  const payload = {
    type: "SINGLE",
    action: commandData.action,
    user,
    ...commandData.data,
  };

  if (preview) {
    return {
      action: payload.action,
      company_id: payload.company_id || "",
      branch_name: payload.branch_name || "",
      branch_location: payload.branch_location || "",
    };
  }

  if (!payload.branch_name) {
    throw new AppError("Branch name is required", 400);
  }

  return executeBranchAction(payload);
};
