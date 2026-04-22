import { AppError } from "../utils/AppError.js";

export const parseCompanyCommand = async (message) => {
  if (!message) {
    throw new Error("Empty command");
  }

  const text = message.toLowerCase().trim();

  // =========================
  // Detect action
  // =========================
  let action = null;

  if (text.includes("add") || text.includes("create")) {
    action = "CREATE_COMPANY";
  } 
  else if (text.includes("update") || text.includes("edit")) {
    action = "UPDATE_COMPANY";
  } 
  else if (text.includes("deactivate") || text.includes("inactive")) {
    action = "DEACTIVATE_COMPANY";
  } 
  else if (text.includes("activate")) {
    action = "ACTIVATE_COMPANY";
  }

  if (!action) {
    throw new AppError(
      "Could not understand your command. Try: 'Add company ABC with transport'",
      400
    );
  }

  // =========================
  // Extract company name (FIXED REGEX)
  // =========================
  let company_name = "";

  const nameMatch = message.match(
    /(?:add|create|update|edit|deactivate|activate)(?:\s+company)?\s+(.+?)(?:\s+with|\s+type|$)/i
  );

  if (nameMatch && nameMatch[1]) {
    company_name = nameMatch[1].trim();
  }

  // =========================
  // Extract business type
  // =========================
  let business_type = "";
  let updates = {};

  // CREATE → use "with"
  if (action === "CREATE_COMPANY") {
    const match = message.match(/with\s+(.+)/i);
    if (match && match[1]) {
      business_type = match[1].trim();
    }
  }

  // UPDATE → use "type"
  if (action === "UPDATE_COMPANY") {
    const match = message.match(/(?:type|business type)\s+(.+)/i);
    if (match && match[1]) {
      updates.business_type = match[1].trim();
    }
  }

  // =========================
  // Capitalize safely
  // =========================
  const capitalize = (str = "") =>
    str
      ? str
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : "";

  return {
    action,
    data: {
      company_name: capitalize(company_name),
      business_type: capitalize(business_type), // only for CREATE
      updates: {
        ...(updates.business_type && {
          business_type: capitalize(updates.business_type)
        })
      }
    }
  };
};

export default parseCompanyCommand;