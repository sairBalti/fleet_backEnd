import fs from "fs";
import csv from "csv-parser";

export const parseBranchFile = async (file) => {
  const ext = file.originalname.split(".").pop()?.toLowerCase();

  if (ext !== "csv") {
    return {
      branches: [],
      errors: [
        {
          row: 0,
          column: "file",
          message: "Only CSV is supported for branch bulk upload",
        },
      ],
    };
  }

  const rows = [];
  const errors = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(file.path)
      .pipe(csv())
      .on("data", (data) => rows.push(data))
      .on("end", resolve)
      .on("error", reject);
  });

  const branches = rows.map((row, index) => {
    const rowNumber = index + 1;
    const branch_name = row.branch_name?.trim();
    const branch_location = row.branch_location?.trim() || "";
    const company_id = row.company_id ? Number(row.company_id) : null;

    if (!branch_name) {
      errors.push({
        row: rowNumber,
        column: "branch_name",
        message: "Branch name is required",
      });
    }

    if (row.company_id && Number.isNaN(company_id)) {
      errors.push({
        row: rowNumber,
        column: "company_id",
        message: `Invalid company_id: ${row.company_id}`,
      });
    }

    return {
      branch_name,
      branch_location,
      company_id,
    };
  });

  return { branches, errors };
};
