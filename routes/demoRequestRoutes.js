import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import { getDemoRequestMainPageData, submitDemoRequest } from "../controllers/demoRequestController.js";

const router = express.Router();

router.post("/", submitDemoRequest);
router.post("/targets", verifyToken, getDemoRequestMainPageData);

export default router;
