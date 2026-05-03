import express from "express";
const router = express.Router();
import * as companyController from "../controllers/companyController.js";
import * as aiCompanyController from "../controllers/aiCompanyController.js";
import * as aiBranchController from "../controllers/aiBranchController.js";
import upload from "../utils/multerConfig.js";
import verifyToken from "../middleware/verifyToken.js";




// Protected routes
router.use(verifyToken);

router.post("/live", companyController.getCompanyMainPageData);
console.log("AI Controller:", aiCompanyController);
router.post("/preview", upload.single("file"), aiCompanyController.previewAI);
router.post("/ingest",upload.single("file"), aiCompanyController.handleAIIngest);
router.post("/branchList", companyController.getBranchMainPageData)
router.post("/branch/preview", aiBranchController.previewAIBranch);
router.post("/branch/ingest", upload.single("file"), aiBranchController.handleAIBranchIngest);


export default router;