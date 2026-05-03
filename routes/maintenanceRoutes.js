import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import {
  listMaintenanceWorkOrders,
  getMaintenanceVehicleOptions,
  getWorkOrderById,
  createWorkOrder,
  updateWorkOrder,
  patchWorkOrderStatus,
} from "../controllers/maintenanceController.js";

const router = express.Router();
router.use(verifyToken);

router.get("/work-orders", listMaintenanceWorkOrders);
router.get("/vehicles", getMaintenanceVehicleOptions);
router.get("/work-orders/:id", getWorkOrderById);
router.post("/work-orders", createWorkOrder);
router.put("/work-orders/:id", updateWorkOrder);
router.patch("/work-orders/:id/status", patchWorkOrderStatus);

export default router;
