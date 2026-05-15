import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import { getDashboardKpis, getPortalBusinessTypes, getPortalIntelligence, getPortalNavigation } from "../controllers/portalController.js";

const router = express.Router();

router.use(verifyToken);
router.get("/business-types", getPortalBusinessTypes);
router.get("/navigation", getPortalNavigation);
router.get("/intelligence", getPortalIntelligence);
router.get("/dashboard-kpis", getDashboardKpis);

export default router;
