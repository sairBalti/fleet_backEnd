import { orchestrateAI } from "../ai-agent/orchestrator.js";
import { VALIDATION_MESSAGES } from "../validations/validationMessages.js";
import { VALIDATION_CODES } from "../validations/validationCodes.js";
import { AppError } from "../utils/AppError.js";
export const handleAIIngest = async (req, res, next) => {
    try {
        const { message, company_name, business_type, number_of_branches, total_admins } = req.body;
        const file = req.file;

        // CASE 1: FROM PREVIEW (structured data)
        if (company_name) {
            const result = await orchestrateAI({
                message: null,
                file: null,
                directData: {
                    company_name,
                    business_type,
                    number_of_branches,
                    total_admins
                }
            });

            return res.json({ success: true, data: result });
        }


        if (!message && !file) {
            throw new AppError(
                VALIDATION_MESSAGES.REQUIRED_MESSAGE,
                400,
                VALIDATION_CODES.REQUIRED_FIELD
            );
        }

        const result = await orchestrateAI({
            message,
            file,
            preview: false
        });

        res.json({
            success: true,
            data: result
        });

    } catch (err) {
        next(err) // pass to global handler
    }
};
export const previewAI = async (req, res) => {
    try {
        const { message } = req.body;
        const file = req.file;

        const result = await orchestrateAI({
            message,
            file,
            preview: true //  IMPORTANT FLAG
        });

        res.json({
            success: true,
            preview: result
        });

    } catch (err) {
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message
        });
    }
};