import express from "express";
const router = express.Router();
import * as getCompanyBranchLookup from "../controllers/lookupController.js";
import verifyToken from "../middleware/verifyToken.js";

router.use(verifyToken);

router.post("/getCompanyBranchLookup", getCompanyBranchLookup.getCompanyBranchLookup);



export default router;