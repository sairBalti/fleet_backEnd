import express from "express";
import { authorizeRoles } from "../middleware/authMiddleware.js";
import verifyToken from "../middleware/verifyToken.js";
import { ROLE_GROUPS, ROLES } from "../utils/roles.js";

// ✅ Import controllers
import * as companyController from "../controllers/companyController.js";
import * as aiCompanyController from "../controllers/aiCompanyController.js";
import * as driverController from "../controllers/driverController.js";
import * as maintenanceController from "../controllers/maintenanceController.js";
import * as vehicleController from "../controllers/vehicleController.js";
import upload from "../utils/multerConfig.js";


const router = express.Router();
router.post("/preview", upload.single("file"), aiCompanyController.previewAI);
router.post("/ingest",upload.single("file"),aiCompanyController.handleAIIngest);

// Only SuperAdmin/Admin can create companies
router.post(
  "/companies",
  verifyToken,
  authorizeRoles(...ROLE_GROUPS.SYSTEM),
  aiCompanyController.handleAIIngest
);

// CompanyAdmin and BranchManager can add drivers
router.post(
  "/drivers",
  verifyToken,
  authorizeRoles(ROLES.COMPANY_ADMIN, ROLES.BRANCH_MANAGER),
  driverController.createDriver
);

// Maintenance only
router.put(
  "/maintenance/:id",
  verifyToken,
  authorizeRoles(ROLES.MAINTENANCE),
  maintenanceController.update
);



export default router;
