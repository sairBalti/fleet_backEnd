import { changeCompanyStatus, insertCompany, updateCompany } from "../services/companyService.js";
import { AppError } from "../utils/AppError.js";

export const executeAction = async (payload) => {
    console.log("EXECUTE PAYLOAD:", payload);

    if (payload.type === "BULK") {
        const results = [];

        for (let index = 0; index < payload.companies.length; index++) {
            const company = payload.companies[index];

            try {
                await insertCompany(company);

                results.push({
                    ...company,
                    status: "success"
                });

            } catch (error) {

                results.push({
                    ...company,
                    status: "failed",
                    error: error.message
                });
            }
        }

        //  CHECK FAILURES
        const failed = results.filter(r => r.status === "failed");

        if (failed.length > 0) {
            throw new AppError(
                "Bulk validation failed",
                422,
                "BULK_VALIDATION_ERROR",
                {
                    details: failed.map((f, idx) => ({
                        row: idx + 1, // or track actual index
                        column: "company_name",
                        message: f.error
                    }))
                }
            );
        }

        //  ONLY SUCCESS IF NO FAILURES
        return {
            success: true,
            type: "BULK",
            results
        };
    }

    // =========================
    // SINGLE FLOW (NO CHANGE)
    // =========================
    if (payload.type === "SINGLE") {

        if (payload.action === "CREATE_COMPANY") {
            await insertCompany(payload);
        }

        else if (payload.action === "UPDATE_COMPANY") {
            await updateCompany(payload);
        }

        else if (payload.action === "DEACTIVATE_COMPANY") {
            await changeCompanyStatus(payload.company_name, 0);
        }

        else if (payload.action === "ACTIVATE_COMPANY") {
            await changeCompanyStatus(payload.company_name, 1);
        }

        else {
            throw new AppError("Invalid action type", 400);
        }

        return {
            success: true,
            type: "SINGLE",
            action: payload.action,
            data: payload
        };
    }
};