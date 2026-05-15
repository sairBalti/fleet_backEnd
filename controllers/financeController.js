import db from "../config/db.js";
import { AppError } from "../utils/AppError.js";

const BRANCH_SCOPED_ROLES = new Set([
  "BranchManager",
  "Driver",
  "Maintenance",
  "Supervisor",
  "Worker",
  "Contractor",
]);

const ADMIN_ROLES = new Set(["SuperAdmin", "Admin"]);

const resolveAccessScope = async (userId) => {
  const [rows] = await db.execute(
    `SELECT u.company_id, u.branch_id, lr.role_name
     FROM users u
     INNER JOIN lookup_roles lr ON lr.role_id = u.role_id
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

const scope = (access, companyId, branchId) => {
  let c = companyId != null ? Number(companyId) : null;
  let b = branchId != null ? Number(branchId) : null;
  if (!ADMIN_ROLES.has(access.role_name)) {
    c = access.company_id;
    if (BRANCH_SCOPED_ROLES.has(access.role_name)) b = access.branch_id;
  }
  return { companyId: c, branchId: b };
};

export const getFinanceKpis = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const scoped = scope(access, req.query.companyId, req.query.branchId);
    if (!scoped.companyId) {
      return res.json({
        success: true,
        data: {
          kpi: {},
          budgetLines: [],
        },
      });
    }

    const [result] = await db.execute("CALL construction_spFinanceKpis(?,?)", [scoped.companyId, scoped.branchId]);
    const kpi = result?.[0]?.[0] || {};
    const budgetLines = result?.[1] || [];
    return res.json({ success: true, data: { kpi, budgetLines } });
  } catch (error) {
    next(error);
  }
};

export const listBudgets = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const scoped = scope(access, req.query.companyId, req.query.branchId);
    if (!scoped.companyId) return res.json({ success: true, data: [] });

    const [result] = await db.execute("CALL construction_spBudgetsList(?,?,?)", [
      scoped.companyId,
      scoped.branchId,
      req.query.searchText || null,
    ]);
    return res.json({ success: true, data: result?.[0] || [] });
  } catch (error) {
    next(error);
  }
};

export const upsertBudget = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const body = req.body || {};
    const scoped = scope(access, body.company_id, body.branch_id);
    if (!scoped.companyId || !scoped.branchId) throw new AppError("company_id and branch_id required", 400);
    if (!body.budget_name || !body.period_start || !body.period_end) {
      throw new AppError("budget_name, period_start, period_end required", 400);
    }

    const [rows] = await db.execute("CALL construction_spBudgetUpsert(?,?,?,?,?,?,?,?,?,?,?)", [
      Number(body.budget_id || 0),
      scoped.companyId,
      scoped.branchId,
      body.project_id ? Number(body.project_id) : null,
      String(body.budget_name).trim(),
      body.period_start,
      body.period_end,
      Number(body.amount_budgeted ?? 0),
      body.alert_threshold_percent != null ? Number(body.alert_threshold_percent) : 90,
      body.notes || null,
      req.user.user_id,
    ]);
    const budgetId = Number(rows?.[0]?.[0]?.budget_id);
    if (!budgetId) throw new AppError("Could not save budget", 500);
    return res.json({ success: true, data: { budget_id: budgetId } });
  } catch (error) {
    next(error);
  }
};

export const listExpenses = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const scoped = scope(access, req.query.companyId, req.query.branchId);
    if (!scoped.companyId) {
      return res.json({
        success: true,
        data: [],
        pagination: { pageNumber: 1, pageSize: 20, totalRecords: 0 },
      });
    }

    const [result] = await db.execute("CALL construction_spExpensesList(?,?,?,?,?,?)", [
      scoped.companyId,
      scoped.branchId,
      req.query.status || null,
      req.query.searchText || null,
      Math.max(1, Number(req.query.pageNumber) || 1),
      Math.max(1, Math.min(100, Number(req.query.pageSize) || 20)),
    ]);

    const total = Number(result?.[0]?.[0]?.totalRecords || 0);
    const rows = result?.[1] || [];
    return res.json({
      success: true,
      data: rows,
      pagination: {
        pageNumber: Math.max(1, Number(req.query.pageNumber) || 1),
        pageSize: Math.max(1, Math.min(100, Number(req.query.pageSize) || 20)),
        totalRecords: total,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const upsertExpense = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const body = req.body || {};
    const scoped = scope(access, body.company_id, body.branch_id);
    if (!scoped.companyId || !scoped.branchId) throw new AppError("company_id and branch_id required", 400);
    if (!body.description || body.amount == null || !body.expense_date) {
      throw new AppError("description, amount, expense_date required", 400);
    }

    const [rows] = await db.execute("CALL construction_spExpenseUpsert(?,?,?,?,?,?,?,?,?,?,?,?)", [
      Number(body.expense_id || 0),
      scoped.companyId,
      scoped.branchId,
      body.project_id ? Number(body.project_id) : null,
      body.budget_id ? Number(body.budget_id) : null,
      body.category || null,
      String(body.description).trim(),
      Number(body.amount),
      body.expense_date,
      body.payee || null,
      body.status || "Draft",
      req.user.user_id,
    ]);
    const expenseId = Number(rows?.[0]?.[0]?.expense_id);
    if (!expenseId) throw new AppError("Could not save expense", 500);
    return res.json({ success: true, data: { expense_id: expenseId } });
  } catch (error) {
    next(error);
  }
};

export const listInvoices = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const scoped = scope(access, req.query.companyId, req.query.branchId);
    if (!scoped.companyId) {
      return res.json({
        success: true,
        data: [],
        pagination: { pageNumber: 1, pageSize: 20, totalRecords: 0 },
      });
    }

    const [result] = await db.execute("CALL construction_spInvoicesList(?,?,?,?,?,?,?)", [
      scoped.companyId,
      scoped.branchId,
      req.query.direction || null,
      req.query.status || null,
      req.query.searchText || null,
      Math.max(1, Number(req.query.pageNumber) || 1),
      Math.max(1, Math.min(100, Number(req.query.pageSize) || 20)),
    ]);

    const total = Number(result?.[0]?.[0]?.totalRecords || 0);
    const rows = result?.[1] || [];
    return res.json({
      success: true,
      data: rows,
      pagination: {
        pageNumber: Math.max(1, Number(req.query.pageNumber) || 1),
        pageSize: Math.max(1, Math.min(100, Number(req.query.pageSize) || 20)),
        totalRecords: total,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const upsertInvoice = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const body = req.body || {};
    const scoped = scope(access, body.company_id, body.branch_id);
    if (!scoped.companyId || !scoped.branchId) throw new AppError("company_id and branch_id required", 400);
    if (!body.invoice_number || !body.counterparty_name || !body.issue_date) {
      throw new AppError("invoice_number, counterparty_name, issue_date required", 400);
    }

    const amt = Number(body.amount ?? 0);
    const tax = Number(body.tax_amount ?? 0);
    const total =
      body.total_amount != null && body.total_amount !== ""
        ? Number(body.total_amount)
        : amt + tax;

    const [rows] = await db.execute("CALL construction_spInvoiceUpsert(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [
      Number(body.invoice_id || 0),
      scoped.companyId,
      scoped.branchId,
      body.project_id ? Number(body.project_id) : null,
      String(body.invoice_number).trim(),
      String(body.counterparty_name).trim(),
      body.invoice_direction || "Receivable",
      amt,
      tax,
      total,
      body.issue_date,
      body.due_date || null,
      body.status || "Draft",
      body.notes || null,
      req.user.user_id,
    ]);
    const invoiceId = Number(rows?.[0]?.[0]?.invoice_id);
    if (!invoiceId) throw new AppError("Could not save invoice", 500);
    return res.json({ success: true, data: { invoice_id: invoiceId } });
  } catch (error) {
    next(error);
  }
};

export const listPayments = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const scoped = scope(access, req.query.companyId, req.query.branchId);
    if (!scoped.companyId) {
      return res.json({
        success: true,
        data: [],
        pagination: { pageNumber: 1, pageSize: 20, totalRecords: 0 },
      });
    }

    const [result] = await db.execute("CALL construction_spPaymentsList(?,?,?,?,?,?)", [
      scoped.companyId,
      scoped.branchId,
      req.query.category || null,
      req.query.searchText || null,
      Math.max(1, Number(req.query.pageNumber) || 1),
      Math.max(1, Math.min(100, Number(req.query.pageSize) || 20)),
    ]);

    const total = Number(result?.[0]?.[0]?.totalRecords || 0);
    const rows = result?.[1] || [];
    return res.json({
      success: true,
      data: rows,
      pagination: {
        pageNumber: Math.max(1, Number(req.query.pageNumber) || 1),
        pageSize: Math.max(1, Math.min(100, Number(req.query.pageSize) || 20)),
        totalRecords: total,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const upsertPayment = async (req, res, next) => {
  try {
    const access = await resolveAccessScope(req.user.user_id);
    if (!access) throw new AppError("Forbidden", 403);
    const body = req.body || {};
    const scoped = scope(access, body.company_id, body.branch_id);
    if (!scoped.companyId || !scoped.branchId) throw new AppError("company_id and branch_id required", 400);
    if (!body.payee_name || body.amount == null || !body.payment_date) {
      throw new AppError("payee_name, amount, payment_date required", 400);
    }

    const [rows] = await db.execute("CALL construction_spPaymentUpsert(?,?,?,?,?,?,?,?,?,?,?,?)", [
      Number(body.payment_id || 0),
      scoped.companyId,
      scoped.branchId,
      body.invoice_id ? Number(body.invoice_id) : null,
      body.budget_id ? Number(body.budget_id) : null,
      String(body.payee_name).trim(),
      body.payment_category || "Vendor",
      Number(body.amount),
      body.payment_date,
      body.reference_no || null,
      body.notes || null,
      req.user.user_id,
    ]);
    const paymentId = Number(rows?.[0]?.[0]?.payment_id);
    if (!paymentId) throw new AppError("Could not save payment", 500);
    return res.json({ success: true, data: { payment_id: paymentId } });
  } catch (error) {
    next(error);
  }
};
