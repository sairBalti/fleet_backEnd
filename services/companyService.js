import db from "../config/db.js";
import { getBusinessTypeId } from "../utils/businessTypeMapper.js";
import { AppError } from "../utils/AppError.js";
import { VALIDATION_MESSAGES } from "../validations/validationMessages.js";
import { VALIDATION_CODES } from "../validations/validationCodes.js";
export const checkCompanyExists = async (companyName, businessTypeId) => {
    const [rows] = await db.execute(
        `SELECT company_id 
         FROM companies 
         WHERE company_name = ? 
         AND business_type_id = ?
         LIMIT 1`,
        [companyName, businessTypeId]
    );

    return rows.length > 0;
};

export const insertCompany = async (data) => {


    // 🔥 STEP 1: Resolve business type FIRST
    const businessTypeId =
        typeof data.business_type === "number"
            ? data.business_type
            : getBusinessTypeId(data.business_type);

    if (!businessTypeId) {
        throw new AppError(
            "Invalid business type",
            400,
            VALIDATION_CODES.INVALID_INPUT,
            { field: "business_type" }
        );
    }

    // 🔥 STEP 2: Check duplicate using BOTH fields
    const exists = await checkCompanyExists(
        data.company_name,
        businessTypeId
    );
    console.log("Incoming:", data.company_name, data.business_type);
    console.log("Mapped businessTypeId:", businessTypeId);

    if (exists) {
        throw new AppError(
            `Company "${data.company_name}" already exists for this business type`,
            409,
            VALIDATION_CODES.DUPLICATE_COMPANY,
            { field: "company_name" }
        );
    }

    if (!data.company_name || data.company_name.trim() === "") {
        throw new AppError(
            "Company name is required", 
            400, 
            { field: "company_name" }
        );
    }
    //  STEP 3: Insert
    const payload = [
        data.company_name ?? null,
        businessTypeId,
        data.number_of_branches ?? 0,
        data.is_active ?? 1
    ];

    console.log("DB PAYLOAD:", payload);

    await db.execute(
        "CALL portal_spCompanyInsert(?, ?, ?, ?)",
        payload
    );

    return {
        success: true,
        company: data.company_name
    };
};

export const updateCompany = async (data) => {

    if (!data.company_name) {
        throw new AppError("Company name is required", 400);
    }

    const businessTypeId = getBusinessTypeId(data.updates?.business_type);

    if (!businessTypeId) {
        throw new AppError("Invalid business type", 400, null, {
            field: "business_type"
        });
    }

    await db.execute(
        "UPDATE companies SET business_type_id = ? WHERE company_name = ?",
        [businessTypeId, data.company_name]
    );

    return {
        success: true,
        message: "Company updated successfully"
    };
};

export const changeCompanyStatus = async (companyName, status) => {

    if (!companyName) {
        throw new AppError("Company name is required", 400);
    }

    const [result] = await db.execute(
        "UPDATE companies SET is_active = ? WHERE company_name = ?",
        [status, companyName]
    );

    if (result.affectedRows === 0) {
        throw new AppError("Company not found", 404);
    }

    return {
        success: true,
        message: `Company ${status ? "activated" : "deactivated"} successfully`
    };
};