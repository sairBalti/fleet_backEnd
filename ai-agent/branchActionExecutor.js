import { AppError } from "../utils/AppError.js";
import { changeBranchStatus, insertBranch, updateBranch } from "../services/branchService.js";

export const executeBranchAction = async (payload) => {
  if (payload.type === "BULK") {
    const results = [];

    for (let index = 0; index < payload.branches.length; index += 1) {
      const branch = payload.branches[index];

      try {
        await insertBranch({
          user: payload.user,
          company_id: branch.company_id ?? payload.company_id ?? null,
          branch_name: branch.branch_name,
          branch_location: branch.branch_location,
        });

        results.push({ ...branch, status: "success" });
      } catch (error) {
        results.push({
          ...branch,
          status: "failed",
          error: error.message,
        });
      }
    }

    const failed = results.filter((row) => row.status === "failed");
    if (failed.length > 0) {
      throw new AppError("Bulk validation failed", 422, "BULK_VALIDATION_ERROR", {
        details: failed.map((row, idx) => ({
          row: idx + 1,
          column: "branch_name",
          message: row.error,
        })),
      });
    }

    return {
      success: true,
      type: "BULK",
      results,
    };
  }

  if (payload.type !== "SINGLE") {
    throw new AppError("Unsupported payload type for branch action", 400);
  }

  if (payload.action === "CREATE_BRANCH") {
    await insertBranch(payload);
  } else if (payload.action === "UPDATE_BRANCH") {
    await updateBranch(payload);
  } else if (payload.action === "DEACTIVATE_BRANCH") {
    await changeBranchStatus(payload, 1);
  } else if (payload.action === "ACTIVATE_BRANCH") {
    await changeBranchStatus(payload, 0);
  } else {
    throw new AppError("Invalid action type", 400);
  }

  return {
    success: true,
    type: "SINGLE",
    action: payload.action,
    data: payload,
  };
};
