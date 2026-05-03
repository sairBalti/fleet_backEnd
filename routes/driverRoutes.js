import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import upload from "../utils/multerConfig.js";
import {
  getDriverPerformancePageData,
  getDriverSchedulePageData,
  getDriversList,
  getDriverById,
  createDriver,
  updateDriver,
  patchDriverStatus,
  deleteDriver,
} from "../controllers/driverController.js";
import { previewScheduleAi, commitScheduleAi } from "../controllers/aiDriverScheduleController.js";

const router = express.Router();
router.use(verifyToken);

router.post("/schedule", getDriverSchedulePageData);
router.post("/schedule-ai/preview", upload.single("file"), previewScheduleAi);
router.post("/schedule-ai/commit", commitScheduleAi);
router.get("/performance", getDriverPerformancePageData);

router.post("/list", getDriversList);
router.get("/profile/:id", getDriverById);
router.post("/", createDriver);
router.put("/profile/:id", updateDriver);
router.patch("/profile/:id/status", patchDriverStatus);
router.delete("/profile/:id", deleteDriver);

export default router;
