import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import upload from "../utils/multerConfig.js";
import {
  assignUser,
  changeProjectStatus,
  createProject,
  getProjectDashboard,
  getProjectDetail,
  listAssignableUsers,
  listProjects,
  updateProject,
  upsertMilestone,
  upsertTask,
} from "../controllers/constructionController.js";
import {
  assignWorker,
  getAttendanceReport,
  getWorkforceAnalytics,
  getWorkforceScheduleMonth,
  listConsEmployeeLookup,
  listEmployees,
  markAttendance,
  upsertEmployee,
  upsertShiftSchedule,
} from "../controllers/workforceController.js";
import {
  adjustInventory,
  autoGenerateLowStockDraftPo,
  createPurchaseOrder,
  listInventory,
  listPurchaseOrders,
  listSuppliers,
  logMaterialUsage,
  upsertMaterial,
  upsertSupplier,
} from "../controllers/materialController.js";
import {
  createInspection,
  getInspectionDetail,
  listInspections,
  patchIssueStatus,
  updateInspection,
  uploadInspectionImage,
  upsertInspectionIssue,
  upsertInspectionItem,
} from "../controllers/inspectionController.js";
import {
  getFinanceKpis,
  listBudgets,
  listExpenses,
  listInvoices,
  listPayments,
  upsertBudget,
  upsertExpense,
  upsertInvoice,
  upsertPayment,
} from "../controllers/financeController.js";
import { getReportingSummary } from "../controllers/reportingController.js";
import {
  getUnreadCount,
  listNotifications,
  markAllRead,
  markNotificationRead,
} from "../controllers/notificationController.js";
import { runAutomationNow } from "../controllers/automationController.js";

const router = express.Router();
router.use(verifyToken);

router.get("/projects", listProjects);
router.post("/projects", createProject);
router.get("/projects/:id", getProjectDetail);
router.put("/projects/:id", updateProject);
router.post("/projects/:id/assignments", assignUser);
router.patch("/projects/:id/status", changeProjectStatus);
router.post("/projects/:id/milestones", upsertMilestone);
router.post("/projects/:id/tasks", upsertTask);
router.get("/projects/:id/assignable-users", listAssignableUsers);
router.get("/dashboard", getProjectDashboard);
router.get("/workforce/employees", listEmployees);
router.get("/workforce/cons-employee-lookup", listConsEmployeeLookup);
router.post("/workforce/employees", upsertEmployee);
router.post("/workforce/shifts", upsertShiftSchedule);
router.post("/workforce/assignments", assignWorker);
router.post("/workforce/attendance", markAttendance);
router.get("/workforce/attendance-report", getAttendanceReport);
router.get("/workforce/analytics", getWorkforceAnalytics);
router.get("/workforce/schedule-month", getWorkforceScheduleMonth);
router.get("/materials/suppliers", listSuppliers);
router.post("/materials/suppliers", upsertSupplier);
router.post("/materials", upsertMaterial);
router.get("/materials/inventory", listInventory);
router.post("/materials/inventory-adjust", adjustInventory);
router.post("/materials/usage", logMaterialUsage);
router.post("/materials/purchase-orders", createPurchaseOrder);
router.get("/materials/purchase-orders", listPurchaseOrders);
router.post("/materials/auto-draft-po", autoGenerateLowStockDraftPo);

router.get("/inspections", listInspections);
router.post("/inspections", createInspection);
router.get("/inspections/:id", getInspectionDetail);
router.put("/inspections/:id", updateInspection);
router.post("/inspections/:id/items", upsertInspectionItem);
router.post("/inspections/:id/issues", upsertInspectionIssue);
router.patch("/inspections/issues/:issueId", patchIssueStatus);
router.post("/inspections/:id/images", upload.single("image"), uploadInspectionImage);

router.get("/finance/kpis", getFinanceKpis);
router.get("/finance/budgets", listBudgets);
router.post("/finance/budgets", upsertBudget);
router.get("/finance/expenses", listExpenses);
router.post("/finance/expenses", upsertExpense);
router.get("/finance/invoices", listInvoices);
router.post("/finance/invoices", upsertInvoice);
router.get("/finance/payments", listPayments);
router.post("/finance/payments", upsertPayment);

router.get("/reporting/summary", getReportingSummary);

router.get("/notifications", listNotifications);
router.get("/notifications/unread-count", getUnreadCount);
router.patch("/notifications/:id/read", markNotificationRead);
router.post("/notifications/read-all", markAllRead);

router.post("/automation/run", runAutomationNow);

export default router;

