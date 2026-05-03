import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import { getAnnualReports, getMonthlyReports } from "../controllers/reportsController.js";

const router = express.Router();
router.use(verifyToken);

router.get("/monthly", getMonthlyReports);
router.get("/annual", getAnnualReports);

export default router;
