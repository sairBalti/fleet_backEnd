// controllers/companyController.js
import express from "express";
const router = express.Router();
import db from "../config/db.js";
import { AppError } from "../utils/AppError.js";

export const getCompanyMainPageData = async (req, res) => {
    try {
        const {
            pageNumber = 1,
            pageSize = 20,
            sortColumn = '',
            sortDirection = '',
            nameFilter = null,
            statusFilter = null,
            startDate = null,
            endDate = null,
            companyId = null
        } = req.body;
        const companyIds = req.user.company_ids;
        const branchIds = req.user.branch_ids;

        const query = `
            CALL portal_spCompanyMainPageData(
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        `;

        const [result] = await db.execute(query, [
            pageNumber,
            pageSize,
            sortColumn,
            sortDirection,
            nameFilter,
            statusFilter,
            startDate,
            endDate,
            companyIds,   //  NEW
            branchIds     //  NEW
        ]);

        // MySQL returns multiple result sets for stored procedures
        const companies = result[0];
        const totalRecords = result[1]?.[0]?.totalRecords || 0;

        res.status(200).json({
            success: true,
            message: "data fetched successfully",
            data: companies,
            pagination: {
                pageNumber: Number(pageNumber),
                pageSize: Number(pageSize),
                totalRecords,
                totalPages: Math.ceil(totalRecords / pageSize)
            }
        });

    } catch (error) {
        console.error("Error fetching company main page data:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

export const getBranchMainPageData = async (req, res, next) => {
    try {
        const {
            pageNumber = 1,
            pageSize = 20,
            sortColumn = '',
            sortDirection = '',
            branchNameFilter = null,
            statusFilter = null,
            companyId = null
        } = req.body;

        let companyIds = null;
        let branchIds = null;
        

         // =========================
        // 🔥 ROLE BASED ACCESS
        // =========================

        if (req.user.role === "SuperAdmin") {

            if (!companyId) {
                return next(new AppError("Company ID is required", 400));
            }

            companyIds = String(companyId);
            branchIds = null;
        }

        else if (req.user.role === "CompanyAdmin") {

            companyIds = req.user.company_ids;
            branchIds = null;

            // Optional strict check
            if (companyId) {
                const allowed = req.user.company_ids?.split(",") || [];

                if (!allowed.includes(String(companyId))) {
                    return next(new AppError("Unauthorized company access", 403));
                }

                companyIds = String(companyId);
            }
        }

        else if (req.user.role === "BranchManager") {

            // 🔥 IGNORE company completely
            companyIds = null;
            branchIds = req.user.branch_ids;

            if (!branchIds) {
                return next(new AppError("No branch assigned to user", 403));
            }
        }

        else {
            return next(new AppError("Unauthorized role", 403));
        }

        console.log("ROLE:", req.user.role);
        console.log("companyIds:", companyIds);
        console.log("branchIds:", branchIds);
        const query = `CALL portal_spBranchMainPageData(?, ?, ?, ?, ?, ?, ?, ?)`;

        const [result] = await db.execute(query, [
            pageNumber,
            pageSize,
            sortColumn,
            sortDirection,
            branchNameFilter,
            statusFilter,
            companyIds,
            branchIds
        ]);

        const branches = result[0];
        const totalRecords = result[1]?.[0]?.totalRecords || 0;
        const companyMeta = result[2]?.[0] || {};

        res.status(200).json({
            success: true,
            message: "data fetched successfully",
            data: branches,
            companyMeta,
            pagination: {
                pageNumber: Number(pageNumber),
                pageSize: Number(pageSize),
                totalRecords,
                totalPages: Math.ceil(totalRecords / pageSize)
            }
        });

    } catch (error) {
        console.error("Error fetching branch main page data:", error);
        next(error);
    }
};