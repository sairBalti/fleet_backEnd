import db from "../config/db.js";
import { sendAutomationEmail } from "./constructionMail.js";

const ROLES_ALERT = [
  "SuperAdmin",
  "Admin",
  "CompanyAdmin",
  "CompanyManager",
  "ConstructionAdmin",
  "ProjectManager",
  "SiteEngineer",
  "Supervisor",
  "BranchManager",
  "Accountant",
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function getRecipients(companyId, branchId) {
  const placeholders = ROLES_ALERT.map(() => "?").join(",");
  const params = [companyId, ...ROLES_ALERT];
  let sql = `
    SELECT DISTINCT u.id AS user_id, u.email
    FROM users u
    INNER JOIN lookup_roles lr ON lr.role_id = u.role_id
    WHERE u.company_id = ?
      AND lr.role_name IN (${placeholders})
      AND (? IS NULL OR u.branch_id IS NULL OR u.branch_id = ?)
  `;
  params.push(branchId, branchId);
  const [rows] = await db.execute(sql, params);
  return rows;
}

async function insertNotification(recipient, companyId, branchId, category, title, body, linkPath, severity, dedupeKey) {
  const dk = dedupeKey.slice(0, 220);
  const [resultSets] = await db.execute("CALL construction_spNotificationInsert(?,?,?,?,?,?,?,?,?)", [
    recipient.user_id,
    companyId,
    branchId,
    category,
    title,
    body,
    linkPath || null,
    severity,
    dk,
  ]);
  const row = resultSets?.[0]?.[0];
  const inserted = Number(row?.inserted ?? 0);
  const ok = inserted === 1;
  if (ok && recipient.email) {
    try {
      const mailed = await sendAutomationEmail(recipient.email, title, body || title);
      if (mailed) {
        await db.execute(
          `UPDATE construction_notifications SET email_sent_at = CURRENT_TIMESTAMP
           WHERE user_id = ? AND dedupe_key = ?`,
          [recipient.user_id, dk]
        );
      }
    } catch (e) {
      console.error("Automation email failed:", e.message);
    }
  }
  return ok;
}

async function notifyScope(companyId, branchId, category, title, body, linkPath, severity, dedupeSuffix) {
  const recipients = await getRecipients(companyId, branchId);
  const dkey = `${category}:${dedupeSuffix}:${todayStr()}`;
  let count = 0;
  for (const r of recipients) {
    const ok = await insertNotification(r, companyId, branchId, category, title, body, linkPath, severity, dkey);
    if (ok) count += 1;
  }
  return count;
}

export async function runConstructionAutomationCycle() {
  const summary = {
    scopes: 0,
    overdueTasks: 0,
    lowInventory: 0,
    budgetAlerts: 0,
    projectDelays: 0,
    maintenanceDue: 0,
    errors: [],
  };

  try {
    const [scopes] = await db.execute(`
      SELECT DISTINCT company_id, branch_id FROM projects WHERE company_id IS NOT NULL
      UNION
      SELECT DISTINCT company_id, branch_id FROM construction_budgets
      UNION
      SELECT DISTINCT company_id, branch_id FROM materials WHERE is_active = 1
    `);

    const seen = new Set();
    for (const s of scopes) {
      const cid = Number(s.company_id);
      const bid = s.branch_id != null ? Number(s.branch_id) : null;
      const key = `${cid}:${bid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      summary.scopes += 1;

      try {
        const [tasks] = await db.execute(
          `SELECT t.task_id, t.task_name, t.due_date, t.project_id, p.project_name
           FROM project_tasks t
           INNER JOIN projects p ON p.project_id = t.project_id
           WHERE p.company_id = ? AND ( ? IS NULL OR p.branch_id = ? )
             AND t.due_date IS NOT NULL AND t.due_date < CURDATE()
             AND t.status NOT IN ('Done')
           LIMIT 40`,
          [cid, bid, bid]
        );

        for (const t of tasks) {
          const n = await notifyScope(
            cid,
            bid,
            "OverdueTask",
            `Overdue task: ${t.task_name}`,
            `Project "${t.project_name}" — task was due ${String(t.due_date).slice(0, 10)}.`,
            `/construction/projects/${t.project_id}`,
            "Warning",
            `task:${t.task_id}`
          );
          summary.overdueTasks += n;
        }

        const [lowRows] = await db.execute(
          `SELECT m.material_id, m.material_name, m.company_id, m.branch_id
           FROM materials m
           LEFT JOIN inventory i ON i.company_id = m.company_id AND i.branch_id = m.branch_id AND i.material_id = m.material_id
           WHERE m.company_id = ? AND ( ? IS NULL OR m.branch_id = ? )
             AND m.is_active = 1 AND m.min_stock_qty > 0
             AND IFNULL(i.quantity_on_hand, 0) <= m.min_stock_qty
           LIMIT 40`,
          [cid, bid, bid]
        );

        for (const m of lowRows) {
          const n = await notifyScope(
            cid,
            bid,
            "LowInventory",
            `Low stock: ${m.material_name}`,
            `Material is at or below minimum stock level.`,
            "/construction/materials",
            "Critical",
            `inv:${m.material_id}`
          );
          summary.lowInventory += n;
        }

        const [finResult] = await db.execute("CALL construction_spFinanceKpis(?,?)", [cid, bid]);
        const budgetLines = finResult?.[1] || [];
        for (const b of budgetLines) {
          if (b.alert_status !== "Warning" && b.alert_status !== "Overrun") continue;
          const sev = b.alert_status === "Overrun" ? "Critical" : "Warning";
          const n = await notifyScope(
            cid,
            bid,
            "BudgetWarning",
            `Budget ${b.alert_status}: ${b.budget_name}`,
            `Utilization ${b.utilization_pct ?? "?"}% · spent ${Number(b.spent_amount || 0).toFixed(2)} vs budget ${Number(b.amount_budgeted || 0).toFixed(2)}.`,
            "/construction/finance",
            sev,
            `budget:${b.budget_id}`
          );
          summary.budgetAlerts += n;
        }

        const [delayed] = await db.execute(
          `SELECT p.project_id, p.project_name, p.end_date
           FROM projects p
           WHERE p.company_id = ? AND ( ? IS NULL OR p.branch_id = ? )
             AND p.status IN ('Planning','Active','On Hold')
             AND p.end_date IS NOT NULL AND p.end_date < CURDATE()
           LIMIT 20`,
          [cid, bid, bid]
        );

        for (const p of delayed) {
          const n = await notifyScope(
            cid,
            bid,
            "ProjectDelay",
            `Delayed project: ${p.project_name}`,
            `Past planned end date (${String(p.end_date).slice(0, 10)}).`,
            `/construction/projects/${p.project_id}`,
            "Warning",
            `delay:${p.project_id}`
          );
          summary.projectDelays += n;
        }

        const [maintRows] = await db.execute(
          `SELECT work_order_id, title, due_date, company_id, branch_id
           FROM portal_maintenance_work_orders
           WHERE company_id = ? AND ( ? IS NULL OR branch_id = ? )
             AND due_date IS NOT NULL AND due_date < CURDATE()
             AND status IN ('Open','In Progress')
           LIMIT 30`,
          [cid, bid, bid]
        );

        for (const w of maintRows) {
          const n = await notifyScope(
            cid,
            Number(w.branch_id),
            "MaintenanceReminder",
            `Overdue maintenance: ${w.title}`,
            `Work order past due (${String(w.due_date).slice(0, 10)}).`,
            "/maintenance",
            "Warning",
            `maint:${w.work_order_id}`
          );
          summary.maintenanceDue += n;
        }
      } catch (err) {
        summary.errors.push(`${cid}/${bid}: ${err.message}`);
      }
    }
  } catch (e) {
    summary.errors.push(e.message);
  }

  return summary;
}

export function startConstructionAutomationScheduler() {
  if (process.env.AUTOMATION_DISABLED === "1") {
    console.log("Construction automation scheduler disabled (AUTOMATION_DISABLED=1).");
    return () => {};
  }
  const intervalMs = Math.max(60000, Number(process.env.AUTOMATION_INTERVAL_MS || 600000));
  const tick = async () => {
    try {
      const r = await runConstructionAutomationCycle();
      if (process.env.AUTOMATION_LOG === "1") {
        console.log("[automation]", r);
      }
    } catch (e) {
      console.error("[automation] cycle failed:", e.message);
    }
  };
  const id = setInterval(tick, intervalMs);
  tick();
  return () => clearInterval(id);
}
