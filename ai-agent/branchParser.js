import { AppError } from "../utils/AppError.js";

const capitalizeWords = (value = "") =>
  value
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const parseBranchCommand = async (message) => {
  if (!message?.trim()) {
    throw new AppError("Message is required", 400);
  }

  const raw = message.trim();
  const text = raw.toLowerCase();

  let action = null;
  if (text.includes("add") || text.includes("create")) {
    action = "CREATE_BRANCH";
  } else if (text.includes("update") || text.includes("edit")) {
    action = "UPDATE_BRANCH";
  } else if (text.includes("deactivate") || text.includes("inactive")) {
    action = "DEACTIVATE_BRANCH";
  } else if (text.includes("activate")) {
    action = "ACTIVATE_BRANCH";
  }

  if (!action) {
    throw new AppError(
      "Could not understand command. Example: Add branch Lahore Central at Lahore",
      400
    );
  }

  const branchMatch = raw.match(
    /(?:add|create|update|edit|deactivate|inactive|activate)(?:\s+branch)?\s+(.+?)(?:\s+at|\s+in|\s+location|\s+for\s+company|$)/i
  );
  const branch_name = capitalizeWords(branchMatch?.[1] || "");

  const locationMatch = raw.match(/(?:at|in|location)\s+(.+?)(?:\s+for\s+company|$)/i);
  const branch_location = capitalizeWords(locationMatch?.[1] || "");

  const companyMatch = raw.match(/(?:for\s+company|company)\s+(\d+)/i);
  const company_id = companyMatch?.[1] ? Number(companyMatch[1]) : null;

  const parsed = {
    action,
    data: {
      branch_name,
      branch_location,
      company_id,
      updates: {
        ...(branch_location ? { branch_location } : {}),
      },
    },
    confidence: 0.9,
    needsClarification: false,
    clarificationQuestion: "",
  };

  if (!parsed.data.branch_name) {
    parsed.needsClarification = true;
    parsed.confidence = 0.45;
    parsed.clarificationQuestion = "Please provide the branch name.";
  }

  if (action === "UPDATE_BRANCH" && !parsed.data.updates?.branch_location) {
    parsed.needsClarification = true;
    parsed.confidence = 0.45;
    parsed.clarificationQuestion = "Please provide the new branch location for update.";
  }

  return parsed;
};
