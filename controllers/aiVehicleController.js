import fs from "fs";
import db from "../config/db.js";
import { AppError } from "../utils/AppError.js";

const resolveAccessScope = async (userId) => {
  const [rows] = await db.execute(
    `SELECT u.company_id, u.branch_id, lr.role_name
     FROM users u
     INNER JOIN lookup_roles lr ON lr.role_id = u.role_id
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

const resolveFuelTypeId = async (fuelType) => {
  if (!fuelType) return null;
  if (!Number.isNaN(Number(fuelType))) return Number(fuelType);
  const [rows] = await db.execute(
    "SELECT fuel_type_id FROM lookup_fueltypes WHERE LOWER(fuel_type_name) = LOWER(?) LIMIT 1",
    [fuelType]
  );
  return rows[0]?.fuel_type_id || null;
};

const resolveStatusId = async (status) => {
  if (!status) return 1;
  if (!Number.isNaN(Number(status))) return Number(status);
  const [rows] = await db.execute(
    "SELECT status_id FROM lookup_vehiclestatus WHERE LOWER(status_name) = LOWER(?) LIMIT 1",
    [status]
  );
  return rows[0]?.status_id || 1;
};

const parseVehicleCommand = (message = "") => {
  const text = message.trim();
  const lower = text.toLowerCase();
  const isCreate = /\b(add|create|insert|new)\b/.test(lower) && /\bvehicle\b/.test(lower);
  if (!isCreate) {
    return {
      needsClarification: true,
      clarificationQuestion: "Please use an add command like: Add vehicle REG-100 manufacturer Toyota model Hiace company 1 branch 2.",
    };
  }

  const registrationMatch = text.match(/(?:registration|reg)\s*[:=]?\s*([a-zA-Z0-9\-]+)/i);
  const manufacturerMatch = text.match(/manufacturer\s*[:=]?\s*([a-zA-Z0-9\s\-]+)/i);
  const modelMatch = text.match(/model\s*[:=]?\s*([a-zA-Z0-9\s\-]+)/i);
  const companyMatch = text.match(/company\s*[:=]?\s*(\d+)/i);
  const branchMatch = text.match(/branch\s*[:=]?\s*(\d+)/i);
  const fuelMatch = text.match(/fuel(?:\s*type)?\s*[:=]?\s*([a-zA-Z]+)/i);
  const statusMatch = text.match(/status\s*[:=]?\s*([a-zA-Z]+)/i);

  const data = {
    registration: registrationMatch?.[1]?.trim() || "",
    manufacturer: manufacturerMatch?.[1]?.trim() || "",
    model: modelMatch?.[1]?.trim() || "",
    company_id: companyMatch?.[1] ? Number(companyMatch[1]) : null,
    branch_id: branchMatch?.[1] ? Number(branchMatch[1]) : null,
    fuel_type: fuelMatch?.[1] || "Diesel",
    status: statusMatch?.[1] || "Active",
  };

  if (!data.registration || !data.manufacturer || !data.model) {
    return {
      needsClarification: true,
      clarificationQuestion: "Vehicle command is incomplete. Please include registration, manufacturer, and model.",
      data,
    };
  }

  return { action: "CREATE_VEHICLE", data };
};

const insertVehicle = async ({ inputData, user }) => {
  const access = await resolveAccessScope(user.user_id);
  if (!access) throw new AppError("Unable to resolve user role scope", 400);

  let companyId = inputData.company_id || null;
  let branchId = inputData.branch_id || null;

  if (!["SuperAdmin", "Admin"].includes(access.role_name)) {
    companyId = access.company_id;
    if (["BranchManager", "Driver"].includes(access.role_name)) {
      branchId = access.branch_id;
    }
  }

  if (!companyId || !branchId) {
    throw new AppError("Company and Branch are required to add vehicle", 400);
  }

  const fuelTypeId = await resolveFuelTypeId(inputData.fuel_type);
  const statusId = await resolveStatusId(inputData.status);

  await db.execute(
    `INSERT INTO vehicles (
      company_id, branch_id, registration, manufacturer, model,
      date_registered, maintenance_interval_months, fuel_type_id, status_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      companyId,
      branchId,
      inputData.registration,
      inputData.manufacturer,
      inputData.model,
      inputData.date_registered || new Date(),
      inputData.maintenance_interval_months || 6,
      fuelTypeId,
      statusId,
    ]
  );
};

const parseVehicleCsv = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((item) => item.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((item) => item.trim());
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = cols[idx];
    });
    return row;
  });
};

export const previewAIVehicle = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) throw new AppError("Message is required", 400);

    const parsed = parseVehicleCommand(message);
    if (parsed.needsClarification) {
      throw new AppError(parsed.clarificationQuestion, 400);
    }

    return res.json({ success: true, preview: parsed });
  } catch (error) {
    return next(error);
  }
};

export const handleAIVehicleIngest = async (req, res, next) => {
  try {
    const { message } = req.body;
    const file = req.file;

    if (!message && !file) {
      throw new AppError("Message or file is required", 400);
    }

    if (file) {
      const rows = parseVehicleCsv(file.path);
      let inserted = 0;
      for (const row of rows) {
        if (!row.registration || !row.manufacturer || !row.model) continue;
        await insertVehicle({
          user: req.user,
          inputData: {
            registration: row.registration,
            manufacturer: row.manufacturer,
            model: row.model,
            company_id: row.company_id ? Number(row.company_id) : null,
            branch_id: row.branch_id ? Number(row.branch_id) : null,
            fuel_type: row.fuel_type || "Diesel",
            status: row.status || "Active",
          },
        });
        inserted += 1;
      }
      return res.json({ success: true, data: { mode: "BULK", inserted } });
    }

    const parsed = parseVehicleCommand(message);
    if (parsed.needsClarification) {
      throw new AppError(parsed.clarificationQuestion, 400);
    }

    await insertVehicle({
      user: req.user,
      inputData: parsed.data,
    });

    return res.json({ success: true, data: { mode: "SINGLE", action: parsed.action } });
  } catch (error) {
    return next(error);
  }
};
