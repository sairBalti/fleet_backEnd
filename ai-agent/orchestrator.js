import { parseCompanyCommand } from "./companyParser.js";
import { parseFile } from "./fileParser.js";
import { executeAction } from "./actionExecutor.js";
import { VALIDATION_MESSAGES } from "../validations/validationMessages.js";
import { VALIDATION_CODES } from "../validations/validationCodes.js";
import { AppError } from "../utils/AppError.js";

export const orchestrateAI = async ({ message, file, preview = false, directData = null }) => {

    // DIRECT INSERT (FROM PREVIEW)
    if (directData) {
        return await executeAction({
            type: "SINGLE",
            action: directData.action || "CREATE_COMPANY", // 🔥 fallback
            ...directData
        });
}

let commandData = null;
let fileData = null;

// 1. Parse text command if exists
if (message?.trim()) {
    commandData = await parseCompanyCommand(message);
}

// 2. Parse file if exists
if (file) {
    fileData = await parseFile(file);
    // 🔥 VALIDATION FAIL → STOP HERE
    if (fileData.errors.length > 0) {
        throw new AppError(
            "File validation failed",
            400,
            "FILE_VALIDATION_ERROR",
            { details: fileData.errors }
        );
    }
}

// PREVIEW MODE → DO NOT INSERT
if (preview) {
    return {
        company_name: commandData?.data?.company_name || "",
        business_type: commandData?.data?.business_type || "",
        number_of_branches: 0,
        total_admins: 0
    };
}

// BUSINESS VALIDATION STARTS HERE


// Case 1: nothing provided
if (!commandData && !fileData) {
    throw new AppError("No input provided", 400);
}

// Case 2: command validation
if (commandData && !commandData?.data?.company_name) {
    throw new AppError(VALIDATION_MESSAGES.COMPANY_NAME_REQUIRED,
        400,
        VALIDATION_CODES.INVALID_INPUT
    );
}

// Case 2: command validation for UPDATE - must have at least one field to update

if (commandData?.action === "UPDATE_COMPANY" && !commandData.data.updates?.business_type) {
    throw new AppError("No update fields provided", 400);
}

// Case 3: file validation
if (fileData?.companies && fileData.companies.length === 0) {
    throw new AppError(VALIDATION_MESSAGES.EMPTY_FILE_DATA,
        400,
        VALIDATION_CODES.INVALID_INPUT
    );
}

// 3. Decide execution strategy , merge intellegence
let payload = {};

if (fileData?.companies?.length) {
    payload = {
        type: "BULK",
        companies: fileData.companies
    };
} else {
    payload = {
        type: "SINGLE",
        action: commandData.action,
        ...commandData.data
    };
}

return await executeAction(payload);


    // // 3. Merge intelligence
    // return await executeAction({
    //     command: commandData,
    //     file: fileData
    // });
};