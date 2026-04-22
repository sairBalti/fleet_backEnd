import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const pdfParse = require("pdf-parse");
import csv from "csv-parser";
import xlsx from "xlsx";
import { getBusinessTypeId } from "../utils/businessTypeMapper.js";

export const parseFile = async (file) => {

    const ext = file.originalname.split(".").pop();

    // CSV
    if (ext === "csv") {
        const rows = [];
        const errors = [];

        await new Promise((resolve, reject) => {
            fs.createReadStream(file.path)
                .pipe(csv())
                .on("data", (data) => rows.push(data))
                .on("end", resolve)
                .on("error", reject);
        });
        const companies = rows.map((row, index) => {
            const company_name = row.company_name?.trim();
            const business_type = row.business_type?.trim();

            const rowNumber = index + 1; // +2 to account for header and 0-indexing
            // -------------------------
            // VALIDATION
            // -------------------------
            if (!company_name) {
                errors.push({
                    row: rowNumber,
                    column: "company_name",
                    message: "Company name is required"
                });
            }

            if (!business_type) {
                errors.push({
                    row: rowNumber,
                    column: "business_type",
                    message: "Business type is required"
                });
            }

            const businessTypeId = getBusinessTypeId(business_type);

            if (business_type && !businessTypeId) {
                errors.push({
                    row: rowNumber,
                    column: "business_type",
                    message: `Invalid business type: ${business_type}`
                });
            }

            return {
                company_name,
                business_type,
                number_of_branches: Number(row.number_of_branches || 0),
                total_admins: Number(row.total_admins || 0)
            };
        });

        return {
            companies,
            errors
        };
    }

    // PDF
    if (ext === "pdf") {
        const buffer = fs.readFileSync(file.path);
        const data = await pdfParse(buffer);
        return {
            rawText: data.text,
            companies: [],
            errors: [
                {
                    row: 0,
                    column: "file",
                    message: "PDF parsing requires structured format (CSV recommended)"
                }
            ]
        };
    }

    // IMAGE (OCR placeholder)
    if (["png", "jpg", "jpeg"].includes(ext)) {
        return {
            image: file.path,
            note: "OCR to be added",
            companies: [],
            errors: [
                {
                    row: 0,
                    column: "file",
                    message: "OCR not implemented yet"
                }
            ]
        };
    }

    // XML (basic)
    if (ext === "xml") {
        const xml = fs.readFileSync(file.path, "utf-8");
        return {
            companies: [],
            rawText: xml,
            errors: []
        };
    }

    return {
        companies: [],
        errors: [
            {
                row: 0,
                column: "file",
                message: "Unsupported file format"
            }
        ]
    };
};