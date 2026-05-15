import dotenv from "dotenv";
import db from "./config/db.js";

dotenv.config();

const workforceScheduleDaySeqSql = Array.from({ length: 125 }, (_, i) => `SELECT ${i} AS n`).join(" UNION ");

const ddl = [
  `CREATE TABLE IF NOT EXISTS projects (
    project_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    project_name VARCHAR(180) NOT NULL,
    project_code VARCHAR(80) NOT NULL,
    description TEXT NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    status ENUM('Planning','Active','On Hold','Completed','Cancelled') NOT NULL DEFAULT 'Planning',
    priority ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
    progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id),
    UNIQUE KEY uq_project_company_code (company_id, project_code),
    KEY idx_project_scope (company_id, branch_id),
    KEY idx_project_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS project_milestones (
    milestone_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    milestone_name VARCHAR(200) NOT NULL,
    due_date DATE NULL,
    status ENUM('Pending','In Progress','Completed','Delayed') NOT NULL DEFAULT 'Pending',
    sort_order INT NOT NULL DEFAULT 0,
    notes VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (milestone_id),
    KEY idx_pm_project (project_id),
    CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS project_tasks (
    task_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    milestone_id BIGINT UNSIGNED NULL,
    parent_task_id BIGINT UNSIGNED NULL,
    task_name VARCHAR(220) NOT NULL,
    description TEXT NULL,
    start_date DATE NULL,
    due_date DATE NULL,
    status ENUM('Todo','In Progress','Blocked','Done') NOT NULL DEFAULT 'Todo',
    priority ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
    progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id),
    KEY idx_pt_project (project_id),
    KEY idx_pt_parent (parent_task_id),
    CONSTRAINT fk_pt_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    CONSTRAINT fk_pt_milestone FOREIGN KEY (milestone_id) REFERENCES project_milestones(milestone_id) ON DELETE SET NULL,
    CONSTRAINT fk_pt_parent FOREIGN KEY (parent_task_id) REFERENCES project_tasks(task_id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS project_assignments (
    assignment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    user_id INT NOT NULL,
    assignment_role VARCHAR(80) NOT NULL,
    assigned_by INT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (assignment_id),
    UNIQUE KEY uq_project_user_active (project_id, user_id, is_active),
    KEY idx_pa_project (project_id),
    CONSTRAINT fk_pa_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS employees (
    employee_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    user_id INT NULL,
    employee_code VARCHAR(80) NOT NULL,
    employee_name VARCHAR(180) NOT NULL,
    role_title VARCHAR(100) NULL,
    contact_phone VARCHAR(30) NULL,
    employment_type ENUM('Full Time','Part Time','Contract') NOT NULL DEFAULT 'Full Time',
    hourly_rate DECIMAL(10,2) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (employee_id),
    UNIQUE KEY uq_employee_company_code (company_id, employee_code),
    KEY idx_employee_scope (company_id, branch_id),
    KEY idx_employee_active (is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS cons_employee_lookup (
    job_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    job_title VARCHAR(120) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (job_id),
    UNIQUE KEY uq_cons_employee_job_title (job_title),
    KEY idx_cons_employee_lookup_active (is_active, sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS shift_schedules (
    shift_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    employee_id BIGINT UNSIGNED NOT NULL,
    shift_name VARCHAR(80) NOT NULL,
    shift_start DATE NOT NULL,
    shift_end DATE NOT NULL,
    checkin_time TIME NOT NULL,
    checkout_time TIME NOT NULL,
    break_start TIME NULL,
    break_end TIME NULL,
    shift_hours DECIMAL(5,2) NOT NULL DEFAULT 8,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (shift_id),
    KEY idx_shift_scope (company_id, branch_id, employee_id),
    CONSTRAINT fk_shift_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS worker_assignments (
    worker_assignment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    employee_id BIGINT UNSIGNED NOT NULL,
    assignment_role VARCHAR(100) NOT NULL,
    assigned_date DATE NOT NULL,
    unassigned_date DATE NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (worker_assignment_id),
    UNIQUE KEY uq_worker_project_active (project_id, employee_id, is_active),
    KEY idx_wa_project (project_id),
    KEY idx_wa_employee (employee_id),
    CONSTRAINT fk_wa_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS attendance (
    attendance_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    employee_id BIGINT UNSIGNED NOT NULL,
    attendance_date DATE NOT NULL,
    status ENUM('Present','Absent','Leave') NOT NULL DEFAULT 'Present',
    check_in DATETIME NULL,
    check_out DATETIME NULL,
    regular_hours DECIMAL(6,2) NOT NULL DEFAULT 0,
    overtime_hours DECIMAL(6,2) NOT NULL DEFAULT 0,
    daily_log VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (attendance_id),
    UNIQUE KEY uq_attendance_employee_day (employee_id, attendance_date),
    KEY idx_attendance_scope (company_id, branch_id, attendance_date),
    CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    supplier_name VARCHAR(180) NOT NULL,
    contact_person VARCHAR(120) NULL,
    phone VARCHAR(30) NULL,
    email VARCHAR(180) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (supplier_id),
    KEY idx_supplier_scope (company_id, branch_id),
    KEY idx_supplier_active (is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS materials (
    material_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    material_code VARCHAR(80) NOT NULL,
    material_name VARCHAR(180) NOT NULL,
    category VARCHAR(120) NULL,
    unit VARCHAR(30) NOT NULL DEFAULT 'pcs',
    min_stock_qty DECIMAL(12,2) NOT NULL DEFAULT 0,
    unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    supplier_id BIGINT UNSIGNED NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (material_id),
    UNIQUE KEY uq_material_company_code (company_id, material_code),
    KEY idx_material_scope (company_id, branch_id),
    CONSTRAINT fk_material_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS inventory (
    inventory_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    material_id BIGINT UNSIGNED NOT NULL,
    quantity_on_hand DECIMAL(12,2) NOT NULL DEFAULT 0,
    avg_unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    last_movement_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (inventory_id),
    UNIQUE KEY uq_inventory_material_scope (company_id, branch_id, material_id),
    KEY idx_inventory_scope (company_id, branch_id),
    CONSTRAINT fk_inventory_material FOREIGN KEY (material_id) REFERENCES materials(material_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    po_number VARCHAR(80) NOT NULL,
    supplier_id BIGINT UNSIGNED NULL,
    status ENUM('Draft','Submitted','Approved','Received','Cancelled') NOT NULL DEFAULT 'Draft',
    order_date DATE NOT NULL,
    expected_date DATE NULL,
    notes VARCHAR(500) NULL,
    total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (po_id),
    UNIQUE KEY uq_po_scope_number (company_id, po_number),
    KEY idx_po_scope (company_id, branch_id),
    CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS purchase_order_items (
    po_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    po_id BIGINT UNSIGNED NOT NULL,
    material_id BIGINT UNSIGNED NOT NULL,
    quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
    unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    line_total DECIMAL(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (po_item_id),
    KEY idx_poi_po (po_id),
    CONSTRAINT fk_poi_po FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    CONSTRAINT fk_poi_material FOREIGN KEY (material_id) REFERENCES materials(material_id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS material_usage (
    usage_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    project_id BIGINT UNSIGNED NULL,
    material_id BIGINT UNSIGNED NOT NULL,
    quantity_used DECIMAL(12,2) NOT NULL DEFAULT 0,
    usage_date DATE NOT NULL,
    notes VARCHAR(500) NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usage_id),
    KEY idx_usage_scope (company_id, branch_id, usage_date),
    CONSTRAINT fk_usage_material FOREIGN KEY (material_id) REFERENCES materials(material_id) ON DELETE RESTRICT,
    CONSTRAINT fk_usage_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS construction_inspections (
    inspection_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    project_id BIGINT UNSIGNED NULL,
    inspection_type ENUM('Site','Safety','Quality','Other') NOT NULL DEFAULT 'Site',
    title VARCHAR(200) NOT NULL,
    inspection_date DATE NOT NULL,
    status ENUM('Draft','In Progress','Completed','Cancelled') NOT NULL DEFAULT 'Draft',
    overall_result ENUM('Pass','Conditional','Fail','NA') NULL,
    notes TEXT NULL,
    inspector_user_id INT NULL,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (inspection_id),
    KEY idx_inspection_scope (company_id, branch_id),
    KEY idx_inspection_project (project_id),
    KEY idx_inspection_date (inspection_date),
    CONSTRAINT fk_cinsp_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS construction_inspection_items (
    item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    inspection_id BIGINT UNSIGNED NOT NULL,
    category VARCHAR(120) NOT NULL,
    checklist_label VARCHAR(240) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    result ENUM('Pass','Fail','NA') NOT NULL DEFAULT 'NA',
    comments VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (item_id),
    KEY idx_inspection_item_insp (inspection_id),
    CONSTRAINT fk_ci_item_inspection FOREIGN KEY (inspection_id) REFERENCES construction_inspections(inspection_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS construction_inspection_issues (
    issue_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    inspection_id BIGINT UNSIGNED NOT NULL,
    item_id BIGINT UNSIGNED NULL,
    severity ENUM('Low','Medium','High','Critical') NOT NULL DEFAULT 'Medium',
    defect_type VARCHAR(120) NULL,
    description TEXT NOT NULL,
    status ENUM('Open','In Progress','Resolved','Closed') NOT NULL DEFAULT 'Open',
    reported_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (issue_id),
    KEY idx_inspection_issue_insp (inspection_id),
    CONSTRAINT fk_ci_issue_inspection FOREIGN KEY (inspection_id) REFERENCES construction_inspections(inspection_id) ON DELETE CASCADE,
    CONSTRAINT fk_ci_issue_item FOREIGN KEY (item_id) REFERENCES construction_inspection_items(item_id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS construction_inspection_images (
    image_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    inspection_id BIGINT UNSIGNED NOT NULL,
    issue_id BIGINT UNSIGNED NULL,
    file_path VARCHAR(500) NOT NULL,
    caption VARCHAR(240) NULL,
    uploaded_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (image_id),
    KEY idx_inspection_image_insp (inspection_id),
    CONSTRAINT fk_ci_image_inspection FOREIGN KEY (inspection_id) REFERENCES construction_inspections(inspection_id) ON DELETE CASCADE,
    CONSTRAINT fk_ci_image_issue FOREIGN KEY (issue_id) REFERENCES construction_inspection_issues(issue_id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS construction_budgets (
    budget_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    project_id BIGINT UNSIGNED NULL,
    budget_name VARCHAR(200) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    amount_budgeted DECIMAL(14,2) NOT NULL DEFAULT 0,
    alert_threshold_percent DECIMAL(5,2) NOT NULL DEFAULT 90.00,
    notes VARCHAR(500) NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (budget_id),
    KEY idx_cb_scope (company_id, branch_id),
    CONSTRAINT fk_cb_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS construction_expenses (
    expense_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    project_id BIGINT UNSIGNED NULL,
    budget_id BIGINT UNSIGNED NULL,
    category VARCHAR(120) NULL,
    description VARCHAR(500) NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    expense_date DATE NOT NULL,
    payee VARCHAR(200) NULL,
    status ENUM('Draft','Approved','Rejected') NOT NULL DEFAULT 'Draft',
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (expense_id),
    KEY idx_ce_scope (company_id, branch_id, expense_date),
    CONSTRAINT fk_ce_budget FOREIGN KEY (budget_id) REFERENCES construction_budgets(budget_id) ON DELETE SET NULL,
    CONSTRAINT fk_ce_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS construction_invoices (
    invoice_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    project_id BIGINT UNSIGNED NULL,
    invoice_number VARCHAR(80) NOT NULL,
    counterparty_name VARCHAR(200) NOT NULL,
    invoice_direction ENUM('Receivable','Payable') NOT NULL DEFAULT 'Receivable',
    amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(14,2) NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NULL,
    status ENUM('Draft','Sent','Partial','Paid','Overdue','Cancelled') NOT NULL DEFAULT 'Draft',
    notes VARCHAR(500) NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (invoice_id),
    UNIQUE KEY uq_cinv_company_number (company_id, invoice_number),
    KEY idx_cinv_scope (company_id, branch_id),
    CONSTRAINT fk_cinv_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS construction_payments (
    payment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    invoice_id BIGINT UNSIGNED NULL,
    budget_id BIGINT UNSIGNED NULL,
    payee_name VARCHAR(200) NOT NULL,
    payment_category ENUM('Contractor','Vendor','Payroll','Other') NOT NULL DEFAULT 'Vendor',
    amount DECIMAL(14,2) NOT NULL,
    payment_date DATE NOT NULL,
    reference_no VARCHAR(120) NULL,
    notes VARCHAR(500) NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (payment_id),
    KEY idx_cpay_scope (company_id, branch_id, payment_date),
    CONSTRAINT fk_cpay_invoice FOREIGN KEY (invoice_id) REFERENCES construction_invoices(invoice_id) ON DELETE SET NULL,
    CONSTRAINT fk_cpay_budget FOREIGN KEY (budget_id) REFERENCES construction_budgets(budget_id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS construction_notifications (
    notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    category VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NULL,
    link_path VARCHAR(240) NULL,
    severity ENUM('Info','Warning','Critical') NOT NULL DEFAULT 'Warning',
    dedupe_key VARCHAR(220) NOT NULL,
    read_at TIMESTAMP NULL DEFAULT NULL,
    email_sent_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id),
    UNIQUE KEY uq_cn_user_dedupe (user_id, dedupe_key),
    KEY idx_cn_user_read (user_id, read_at),
    KEY idx_cn_scope (company_id, branch_id),
    KEY idx_cn_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const dropProcedures = [
  "DROP PROCEDURE IF EXISTS construction_spProjectCreate",
  "DROP PROCEDURE IF EXISTS construction_spProjectsList",
  "DROP PROCEDURE IF EXISTS construction_spProjectUpdate",
  "DROP PROCEDURE IF EXISTS construction_spProjectAssignUser",
  "DROP PROCEDURE IF EXISTS construction_spProjectStatusChange",
  "DROP PROCEDURE IF EXISTS construction_spProjectDetail",
  "DROP PROCEDURE IF EXISTS construction_spProjectDashboard",
  "DROP PROCEDURE IF EXISTS construction_spMilestoneUpsert",
  "DROP PROCEDURE IF EXISTS construction_spTaskUpsert",
  "DROP PROCEDURE IF EXISTS construction_spEmployeeUpsert",
  "DROP PROCEDURE IF EXISTS construction_spConsEmployeeLookupList",
  "DROP PROCEDURE IF EXISTS construction_spEmployeesList",
  "DROP PROCEDURE IF EXISTS construction_spShiftUpsert",
  "DROP PROCEDURE IF EXISTS construction_spAssignWorker",
  "DROP PROCEDURE IF EXISTS construction_spAttendanceUpsert",
  "DROP PROCEDURE IF EXISTS construction_spAttendanceDailyReport",
  "DROP PROCEDURE IF EXISTS construction_spWorkforceAnalytics",
  "DROP PROCEDURE IF EXISTS construction_spWorkforceScheduleMonth",
  "DROP PROCEDURE IF EXISTS construction_spWorkforceScheduleRange",
  "DROP PROCEDURE IF EXISTS construction_spSupplierUpsert",
  "DROP PROCEDURE IF EXISTS construction_spSuppliersList",
  "DROP PROCEDURE IF EXISTS construction_spMaterialUpsert",
  "DROP PROCEDURE IF EXISTS construction_spInventoryAdjust",
  "DROP PROCEDURE IF EXISTS construction_spInventoryList",
  "DROP PROCEDURE IF EXISTS construction_spMaterialUsageLog",
  "DROP PROCEDURE IF EXISTS construction_spPurchaseOrderCreate",
  "DROP PROCEDURE IF EXISTS construction_spPurchaseOrdersList",
  "DROP PROCEDURE IF EXISTS construction_spAutoLowStockDraftPo",
  "DROP PROCEDURE IF EXISTS construction_spInspectionUpsert",
  "DROP PROCEDURE IF EXISTS construction_spInspectionsList",
  "DROP PROCEDURE IF EXISTS construction_spInspectionItemUpsert",
  "DROP PROCEDURE IF EXISTS construction_spInspectionIssueUpsert",
  "DROP PROCEDURE IF EXISTS construction_spInspectionIssueStatus",
  "DROP PROCEDURE IF EXISTS construction_spInspectionImageInsert",
  "DROP PROCEDURE IF EXISTS construction_spBudgetUpsert",
  "DROP PROCEDURE IF EXISTS construction_spBudgetsList",
  "DROP PROCEDURE IF EXISTS construction_spExpenseUpsert",
  "DROP PROCEDURE IF EXISTS construction_spExpensesList",
  "DROP PROCEDURE IF EXISTS construction_spInvoiceUpsert",
  "DROP PROCEDURE IF EXISTS construction_spInvoicesList",
  "DROP PROCEDURE IF EXISTS construction_spPaymentUpsert",
  "DROP PROCEDURE IF EXISTS construction_spPaymentsList",
  "DROP PROCEDURE IF EXISTS construction_spFinanceKpis",
  "DROP PROCEDURE IF EXISTS construction_spNotificationInsert",
  "DROP PROCEDURE IF EXISTS construction_spNotificationsList",
  "DROP PROCEDURE IF EXISTS construction_spNotificationMarkRead",
  "DROP PROCEDURE IF EXISTS construction_spNotificationsUnreadCount",
];

const procedures = [
  `CREATE PROCEDURE construction_spProjectCreate(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_project_name VARCHAR(180),
    IN p_project_code VARCHAR(80),
    IN p_description TEXT,
    IN p_start_date DATE,
    IN p_end_date DATE,
    IN p_status VARCHAR(30),
    IN p_priority VARCHAR(20),
    IN p_created_by INT
  )
  BEGIN
    INSERT INTO projects (
      company_id, branch_id, project_name, project_code, description, start_date, end_date, status, priority, created_by, updated_by
    ) VALUES (
      p_company_id, p_branch_id, p_project_name, p_project_code, p_description, p_start_date, p_end_date, p_status, p_priority, p_created_by, p_created_by
    );
    SELECT LAST_INSERT_ID() AS project_id;
  END`,
  `CREATE PROCEDURE construction_spProjectsList(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_status VARCHAR(30),
    IN p_search VARCHAR(200),
    IN p_sort_column VARCHAR(40),
    IN p_sort_dir VARCHAR(4),
    IN p_page_number INT,
    IN p_page_size INT
  )
  BEGIN
    DECLARE v_offset INT DEFAULT (GREATEST(IFNULL(p_page_number,1),1) - 1) * GREATEST(IFNULL(p_page_size,20),1);
    DECLARE v_page_size INT DEFAULT GREATEST(IFNULL(p_page_size,20),1);
    DECLARE v_status VARCHAR(30);
    DECLARE v_search VARCHAR(200);
    DECLARE v_sort_column VARCHAR(40);
    DECLARE v_sort_dir VARCHAR(4);

    SET v_status = IFNULL(p_status, '');
    SET v_search = IFNULL(p_search, '');
    SET v_sort_column = IFNULL(p_sort_column, 'start_date');
    SET v_sort_dir = UPPER(IFNULL(p_sort_dir, 'DESC'));

    SELECT COUNT(*) AS totalRecords
    FROM projects p
    WHERE p.company_id = p_company_id
      AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
      AND (
        v_status = ''
        OR (p.status COLLATE utf8mb4_0900_ai_ci) = (v_status COLLATE utf8mb4_0900_ai_ci)
      )
      AND (
        v_search = ''
        OR (p.project_name COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
        OR (p.project_code COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
      );

    SELECT
      p.project_id,
      p.company_id,
      p.branch_id,
      p.project_name,
      p.project_code,
      p.description,
      p.start_date,
      p.end_date,
      p.status,
      p.priority,
      p.progress_percent,
      p.created_at,
      p.updated_at,
      SUM(CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END) AS completed_tasks,
      COUNT(t.task_id) AS total_tasks,
      SUM(CASE WHEN m.status = 'Completed' THEN 1 ELSE 0 END) AS completed_milestones,
      COUNT(DISTINCT m.milestone_id) AS total_milestones
    FROM projects p
    LEFT JOIN project_tasks t ON t.project_id = p.project_id
    LEFT JOIN project_milestones m ON m.project_id = p.project_id
    WHERE p.company_id = p_company_id
      AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
      AND (
        v_status = ''
        OR (p.status COLLATE utf8mb4_0900_ai_ci) = (v_status COLLATE utf8mb4_0900_ai_ci)
      )
      AND (
        v_search = ''
        OR (p.project_name COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
        OR (p.project_code COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
      )
    GROUP BY p.project_id
    ORDER BY
      CASE WHEN (v_sort_column COLLATE utf8mb4_0900_ai_ci) = 'project_name' AND (v_sort_dir COLLATE utf8mb4_0900_ai_ci) = 'ASC' THEN p.project_name END ASC,
      CASE WHEN (v_sort_column COLLATE utf8mb4_0900_ai_ci) = 'project_name' AND (v_sort_dir COLLATE utf8mb4_0900_ai_ci) = 'DESC' THEN p.project_name END DESC,
      CASE WHEN (v_sort_column COLLATE utf8mb4_0900_ai_ci) = 'status' AND (v_sort_dir COLLATE utf8mb4_0900_ai_ci) = 'ASC' THEN p.status END ASC,
      CASE WHEN (v_sort_column COLLATE utf8mb4_0900_ai_ci) = 'status' AND (v_sort_dir COLLATE utf8mb4_0900_ai_ci) = 'DESC' THEN p.status END DESC,
      CASE WHEN (v_sort_column COLLATE utf8mb4_0900_ai_ci) = 'start_date' AND (v_sort_dir COLLATE utf8mb4_0900_ai_ci) = 'ASC' THEN p.start_date END ASC,
      CASE WHEN (v_sort_column COLLATE utf8mb4_0900_ai_ci) = 'start_date' AND (v_sort_dir COLLATE utf8mb4_0900_ai_ci) = 'DESC' THEN p.start_date END DESC,
      p.updated_at DESC
    LIMIT v_page_size OFFSET v_offset;
  END`,
  `CREATE PROCEDURE construction_spProjectUpdate(
    IN p_project_id BIGINT,
    IN p_project_name VARCHAR(180),
    IN p_description TEXT,
    IN p_start_date DATE,
    IN p_end_date DATE,
    IN p_priority VARCHAR(20),
    IN p_updated_by INT
  )
  BEGIN
    UPDATE projects
    SET
      project_name = p_project_name,
      description = p_description,
      start_date = p_start_date,
      end_date = p_end_date,
      priority = p_priority,
      updated_by = p_updated_by
    WHERE project_id = p_project_id;
    SELECT ROW_COUNT() AS affectedRows;
  END`,
  `CREATE PROCEDURE construction_spProjectAssignUser(
    IN p_project_id BIGINT,
    IN p_user_id INT,
    IN p_assignment_role VARCHAR(80),
    IN p_assigned_by INT
  )
  BEGIN
    INSERT INTO project_assignments (project_id, user_id, assignment_role, assigned_by, is_active)
    VALUES (p_project_id, p_user_id, p_assignment_role, p_assigned_by, 1)
    ON DUPLICATE KEY UPDATE assignment_role = VALUES(assignment_role), assigned_by = VALUES(assigned_by), assigned_at = CURRENT_TIMESTAMP;
    SELECT LAST_INSERT_ID() AS assignment_id;
  END`,
  `CREATE PROCEDURE construction_spProjectStatusChange(
    IN p_project_id BIGINT,
    IN p_status VARCHAR(30),
    IN p_updated_by INT
  )
  BEGIN
    UPDATE projects SET status = p_status, updated_by = p_updated_by WHERE project_id = p_project_id;
    SELECT ROW_COUNT() AS affectedRows;
  END`,
  `CREATE PROCEDURE construction_spProjectDetail(IN p_project_id BIGINT)
  BEGIN
    SELECT * FROM projects WHERE project_id = p_project_id LIMIT 1;
    SELECT * FROM project_milestones WHERE project_id = p_project_id ORDER BY sort_order, milestone_id;
    SELECT * FROM project_tasks WHERE project_id = p_project_id ORDER BY COALESCE(parent_task_id, task_id), sort_order, task_id;
    SELECT pa.*, CONCAT(u.firstname, ' ', COALESCE(u.lastname, '')) AS user_name, u.email
    FROM project_assignments pa
    INNER JOIN users u ON u.id = pa.user_id
    WHERE pa.project_id = p_project_id AND pa.is_active = 1
    ORDER BY pa.assignment_id DESC;
  END`,
  `CREATE PROCEDURE construction_spProjectDashboard(IN p_company_id INT, IN p_branch_id INT)
  BEGIN
    SELECT
      COUNT(*) AS total_projects,
      SUM(CASE WHEN status = 'Planning' THEN 1 ELSE 0 END) AS planning_projects,
      SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active_projects,
      SUM(CASE WHEN status = 'On Hold' THEN 1 ELSE 0 END) AS on_hold_projects,
      SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed_projects
    FROM projects p
    WHERE p.company_id = p_company_id
      AND (p_branch_id IS NULL OR p.branch_id = p_branch_id);

    SELECT
      p.project_id,
      p.project_name,
      p.end_date,
      p.status,
      DATEDIFF(CURDATE(), p.end_date) AS days_overdue
    FROM projects p
    WHERE p.company_id = p_company_id
      AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
      AND p.status IN ('Planning','Active','On Hold')
      AND p.end_date IS NOT NULL
      AND p.end_date < CURDATE()
    ORDER BY p.end_date ASC
    LIMIT 10;
  END`,
  `CREATE PROCEDURE construction_spMilestoneUpsert(
    IN p_milestone_id BIGINT,
    IN p_project_id BIGINT,
    IN p_milestone_name VARCHAR(200),
    IN p_due_date DATE,
    IN p_status VARCHAR(20),
    IN p_sort_order INT,
    IN p_notes VARCHAR(500)
  )
  BEGIN
    IF p_milestone_id IS NULL OR p_milestone_id = 0 THEN
      INSERT INTO project_milestones (project_id, milestone_name, due_date, status, sort_order, notes)
      VALUES (p_project_id, p_milestone_name, p_due_date, p_status, p_sort_order, p_notes);
      SELECT LAST_INSERT_ID() AS milestone_id;
    ELSE
      UPDATE project_milestones
      SET milestone_name = p_milestone_name, due_date = p_due_date, status = p_status, sort_order = p_sort_order, notes = p_notes
      WHERE milestone_id = p_milestone_id AND project_id = p_project_id;
      SELECT p_milestone_id AS milestone_id;
    END IF;
  END`,
  `CREATE PROCEDURE construction_spTaskUpsert(
    IN p_task_id BIGINT,
    IN p_project_id BIGINT,
    IN p_milestone_id BIGINT,
    IN p_parent_task_id BIGINT,
    IN p_task_name VARCHAR(220),
    IN p_description TEXT,
    IN p_start_date DATE,
    IN p_due_date DATE,
    IN p_status VARCHAR(20),
    IN p_priority VARCHAR(20),
    IN p_progress_percent DECIMAL(5,2),
    IN p_sort_order INT
  )
  BEGIN
    IF p_task_id IS NULL OR p_task_id = 0 THEN
      INSERT INTO project_tasks (project_id, milestone_id, parent_task_id, task_name, description, start_date, due_date, status, priority, progress_percent, sort_order)
      VALUES (p_project_id, p_milestone_id, p_parent_task_id, p_task_name, p_description, p_start_date, p_due_date, p_status, p_priority, p_progress_percent, p_sort_order);
      SELECT LAST_INSERT_ID() AS task_id;
    ELSE
      UPDATE project_tasks
      SET
        milestone_id = p_milestone_id,
        parent_task_id = p_parent_task_id,
        task_name = p_task_name,
        description = p_description,
        start_date = p_start_date,
        due_date = p_due_date,
        status = p_status,
        priority = p_priority,
        progress_percent = p_progress_percent,
        sort_order = p_sort_order
      WHERE task_id = p_task_id AND project_id = p_project_id;
      SELECT p_task_id AS task_id;
    END IF;
  END`,
  `CREATE PROCEDURE construction_spEmployeeUpsert(
    IN p_employee_id BIGINT,
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_user_id INT,
    IN p_employee_code VARCHAR(80),
    IN p_employee_name VARCHAR(180),
    IN p_role_title VARCHAR(100),
    IN p_contact_phone VARCHAR(30),
    IN p_employment_type VARCHAR(20),
    IN p_hourly_rate DECIMAL(10,2),
    IN p_is_active TINYINT
  )
  BEGIN
    IF p_employee_id IS NULL OR p_employee_id = 0 THEN
      INSERT INTO employees (
        company_id, branch_id, user_id, employee_code, employee_name, role_title, contact_phone, employment_type, hourly_rate, is_active
      ) VALUES (
        p_company_id, p_branch_id, p_user_id, p_employee_code, p_employee_name, p_role_title, p_contact_phone, p_employment_type, p_hourly_rate, IFNULL(p_is_active, 1)
      );
      SELECT LAST_INSERT_ID() AS employee_id;
    ELSE
      UPDATE employees
      SET
        branch_id = p_branch_id,
        user_id = p_user_id,
        employee_code = p_employee_code,
        employee_name = p_employee_name,
        role_title = p_role_title,
        contact_phone = p_contact_phone,
        employment_type = p_employment_type,
        hourly_rate = p_hourly_rate,
        is_active = IFNULL(p_is_active, is_active)
      WHERE employee_id = p_employee_id AND company_id = p_company_id;
      SELECT p_employee_id AS employee_id;
    END IF;
  END`,
  `CREATE PROCEDURE construction_spConsEmployeeLookupList()
  BEGIN
    SELECT
      job_id,
      job_title,
      sort_order
    FROM cons_employee_lookup
    WHERE is_active = 1
    ORDER BY sort_order ASC, job_title ASC;
  END`,
  `CREATE PROCEDURE construction_spEmployeesList(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_search VARCHAR(200),
    IN p_is_active TINYINT,
    IN p_sort_column VARCHAR(40),
    IN p_sort_dir VARCHAR(4),
    IN p_page_number INT,
    IN p_page_size INT
  )
  BEGIN
    DECLARE v_offset INT DEFAULT 0;
    DECLARE v_page_size INT DEFAULT 20;
    DECLARE v_sort_column VARCHAR(40);
    DECLARE v_sort_dir VARCHAR(4);

    SET v_page_size = IFNULL(p_page_size, 20);
    IF v_page_size < 1 THEN SET v_page_size = 20; END IF;
    IF v_page_size > 500 THEN SET v_page_size = 500; END IF;
    SET v_offset = (IF(IFNULL(p_page_number, 0) < 1, 0, p_page_number - 1)) * v_page_size;

    SET v_sort_column = IFNULL(NULLIF(TRIM(IFNULL(p_sort_column, '')), ''), 'employee_name');
    SET v_sort_dir = UPPER(IFNULL(NULLIF(TRIM(IFNULL(p_sort_dir, '')), ''), 'ASC'));
    IF v_sort_dir NOT IN ('ASC', 'DESC') THEN SET v_sort_dir = 'ASC'; END IF;
    IF v_sort_column NOT IN ('employee_name', 'employee_code', 'role_title', 'employee_id', 'employment_type', 'hourly_rate', 'present_days', 'overtime_hours') THEN
      SET v_sort_column = 'employee_name';
    END IF;

    SELECT COUNT(DISTINCT e.employee_id) AS totalRecords
    FROM employees e
    WHERE e.company_id = p_company_id
      AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
      AND (p_is_active IS NULL OR e.is_active = p_is_active)
      AND (
        p_search IS NULL OR p_search = ''
        OR (e.employee_name COLLATE utf8mb4_unicode_ci) LIKE CONCAT('%', p_search COLLATE utf8mb4_unicode_ci, '%')
        OR (e.employee_code COLLATE utf8mb4_unicode_ci) LIKE CONCAT('%', p_search COLLATE utf8mb4_unicode_ci, '%')
      );

    SELECT
      e.*,
      SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_days,
      SUM(IFNULL(a.overtime_hours, 0)) AS overtime_hours
    FROM employees e
    LEFT JOIN attendance a ON a.employee_id = e.employee_id
      AND a.attendance_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND CURDATE()
    WHERE e.company_id = p_company_id
      AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
      AND (p_is_active IS NULL OR e.is_active = p_is_active)
      AND (
        p_search IS NULL OR p_search = ''
        OR (e.employee_name COLLATE utf8mb4_unicode_ci) LIKE CONCAT('%', p_search COLLATE utf8mb4_unicode_ci, '%')
        OR (e.employee_code COLLATE utf8mb4_unicode_ci) LIKE CONCAT('%', p_search COLLATE utf8mb4_unicode_ci, '%')
      )
    GROUP BY e.employee_id
    ORDER BY
      CASE WHEN v_sort_column = 'employee_code' AND v_sort_dir = 'ASC' THEN e.employee_code END ASC,
      CASE WHEN v_sort_column = 'employee_code' AND v_sort_dir = 'DESC' THEN e.employee_code END DESC,
      CASE WHEN v_sort_column = 'employee_name' AND v_sort_dir = 'ASC' THEN e.employee_name END ASC,
      CASE WHEN v_sort_column = 'employee_name' AND v_sort_dir = 'DESC' THEN e.employee_name END DESC,
      CASE WHEN v_sort_column = 'role_title' AND v_sort_dir = 'ASC' THEN e.role_title END ASC,
      CASE WHEN v_sort_column = 'role_title' AND v_sort_dir = 'DESC' THEN e.role_title END DESC,
      CASE WHEN v_sort_column = 'employee_id' AND v_sort_dir = 'ASC' THEN e.employee_id END ASC,
      CASE WHEN v_sort_column = 'employee_id' AND v_sort_dir = 'DESC' THEN e.employee_id END DESC,
      CASE WHEN v_sort_column = 'employment_type' AND v_sort_dir = 'ASC' THEN e.employment_type END ASC,
      CASE WHEN v_sort_column = 'employment_type' AND v_sort_dir = 'DESC' THEN e.employment_type END DESC,
      CASE WHEN v_sort_column = 'hourly_rate' AND v_sort_dir = 'ASC' THEN e.hourly_rate END ASC,
      CASE WHEN v_sort_column = 'hourly_rate' AND v_sort_dir = 'DESC' THEN e.hourly_rate END DESC,
      CASE WHEN v_sort_column = 'present_days' AND v_sort_dir = 'ASC' THEN SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) END ASC,
      CASE WHEN v_sort_column = 'present_days' AND v_sort_dir = 'DESC' THEN SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) END DESC,
      CASE WHEN v_sort_column = 'overtime_hours' AND v_sort_dir = 'ASC' THEN SUM(IFNULL(a.overtime_hours, 0)) END ASC,
      CASE WHEN v_sort_column = 'overtime_hours' AND v_sort_dir = 'DESC' THEN SUM(IFNULL(a.overtime_hours, 0)) END DESC,
      e.employee_name ASC
    LIMIT v_page_size OFFSET v_offset;
  END`,
  `CREATE PROCEDURE construction_spShiftUpsert(
    IN p_shift_id BIGINT,
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_employee_id BIGINT,
    IN p_shift_name VARCHAR(80),
    IN p_shift_start DATE,
    IN p_shift_end DATE,
    IN p_checkin_time TIME,
    IN p_checkout_time TIME,
    IN p_shift_hours DECIMAL(5,2),
    IN p_break_start TIME,
    IN p_break_end TIME
  )
  BEGIN
    IF p_shift_id IS NULL OR p_shift_id = 0 THEN
      INSERT INTO shift_schedules (
        company_id, branch_id, employee_id, shift_name, shift_start, shift_end, checkin_time, checkout_time, shift_hours, break_start, break_end
      ) VALUES (
        p_company_id, p_branch_id, p_employee_id, p_shift_name, p_shift_start, p_shift_end, p_checkin_time, p_checkout_time, IFNULL(p_shift_hours,8), p_break_start, p_break_end
      );
      SELECT LAST_INSERT_ID() AS shift_id;
    ELSE
      UPDATE shift_schedules
      SET
        shift_name = p_shift_name,
        shift_start = p_shift_start,
        shift_end = p_shift_end,
        checkin_time = p_checkin_time,
        checkout_time = p_checkout_time,
        shift_hours = IFNULL(p_shift_hours, shift_hours),
        break_start = p_break_start,
        break_end = p_break_end
      WHERE shift_id = p_shift_id AND company_id = p_company_id;
      SELECT p_shift_id AS shift_id;
    END IF;
  END`,
  `CREATE PROCEDURE construction_spAssignWorker(
    IN p_project_id BIGINT,
    IN p_employee_id BIGINT,
    IN p_assignment_role VARCHAR(100),
    IN p_assigned_date DATE
  )
  BEGIN
    INSERT INTO worker_assignments (project_id, employee_id, assignment_role, assigned_date, is_active)
    VALUES (p_project_id, p_employee_id, p_assignment_role, p_assigned_date, 1)
    ON DUPLICATE KEY UPDATE assignment_role = VALUES(assignment_role), assigned_date = VALUES(assigned_date);
    SELECT LAST_INSERT_ID() AS worker_assignment_id;
  END`,
  `CREATE PROCEDURE construction_spAttendanceUpsert(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_employee_id BIGINT,
    IN p_attendance_date DATE,
    IN p_status VARCHAR(15),
    IN p_check_in DATETIME,
    IN p_check_out DATETIME,
    IN p_daily_log VARCHAR(500)
  )
  BEGIN
    DECLARE v_shift_hours DECIMAL(6,2) DEFAULT 8;
    DECLARE v_total_hours DECIMAL(6,2) DEFAULT 0;
    DECLARE v_regular_hours DECIMAL(6,2) DEFAULT 0;
    DECLARE v_overtime_hours DECIMAL(6,2) DEFAULT 0;

    SELECT ss.shift_hours
    INTO v_shift_hours
    FROM shift_schedules ss
    WHERE ss.employee_id = p_employee_id
      AND p_attendance_date BETWEEN ss.shift_start AND ss.shift_end
    ORDER BY ss.shift_start DESC
    LIMIT 1;

    SET v_shift_hours = IFNULL(v_shift_hours, 8);

    IF p_check_in IS NOT NULL AND p_check_out IS NOT NULL AND p_check_out >= p_check_in THEN
      SET v_total_hours = TIMESTAMPDIFF(MINUTE, p_check_in, p_check_out) / 60;
    END IF;

    SET v_regular_hours = LEAST(v_total_hours, v_shift_hours);
    SET v_overtime_hours = GREATEST(v_total_hours - v_shift_hours, 0);

    INSERT INTO attendance (
      company_id, branch_id, employee_id, attendance_date, status, check_in, check_out, regular_hours, overtime_hours, daily_log
    ) VALUES (
      p_company_id, p_branch_id, p_employee_id, p_attendance_date, p_status, p_check_in, p_check_out, v_regular_hours, v_overtime_hours, p_daily_log
    )
    ON DUPLICATE KEY UPDATE
      status = VALUES(status),
      check_in = VALUES(check_in),
      check_out = VALUES(check_out),
      regular_hours = VALUES(regular_hours),
      overtime_hours = VALUES(overtime_hours),
      daily_log = VALUES(daily_log);

    SELECT
      p_employee_id AS employee_id,
      p_attendance_date AS attendance_date,
      v_regular_hours AS regular_hours,
      v_overtime_hours AS overtime_hours;
  END`,
  `CREATE PROCEDURE construction_spAttendanceDailyReport(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_attendance_date DATE,
    IN p_employee_id BIGINT
  )
  BEGIN
    SELECT
      a.attendance_date,
      e.employee_id,
      e.employee_code,
      e.employee_name,
      e.role_title,
      a.status,
      a.check_in,
      a.check_out,
      a.regular_hours,
      a.overtime_hours,
      a.daily_log
    FROM attendance a
    INNER JOIN employees e ON e.employee_id = a.employee_id
    WHERE a.company_id = p_company_id
      AND (p_branch_id IS NULL OR a.branch_id = p_branch_id)
      AND (p_employee_id IS NULL OR a.employee_id = p_employee_id)
      AND a.attendance_date = p_attendance_date
    ORDER BY e.employee_name;
  END`,
  `CREATE PROCEDURE construction_spWorkforceAnalytics(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_employee_id BIGINT
  )
  BEGIN
    SELECT
      COUNT(*) AS total_employees,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_employees
    FROM employees e
    WHERE e.company_id = p_company_id
      AND (p_branch_id IS NULL OR e.branch_id = p_branch_id);

    SELECT
      a.attendance_date,
      SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_count,
      SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) AS absent_count,
      SUM(CASE WHEN a.status = 'Leave' THEN 1 ELSE 0 END) AS leave_count,
      SUM(a.overtime_hours) AS overtime_hours
    FROM attendance a
    WHERE a.company_id = p_company_id
      AND (p_branch_id IS NULL OR a.branch_id = p_branch_id)
      AND (p_employee_id IS NULL OR a.employee_id = p_employee_id)
      AND a.attendance_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 90 DAY) AND CURDATE()
    GROUP BY a.attendance_date
    ORDER BY a.attendance_date;
  END`,
  `CREATE PROCEDURE construction_spWorkforceScheduleMonth(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_month_first DATE
  )
  BEGIN
    DECLARE v_last DATE;
    SET v_last = LAST_DAY(p_month_first);

    SELECT
      cald.schedule_date,
      CASE
        WHEN TIME(ss.checkin_time) >= TIME('00:00:00') AND TIME(ss.checkin_time) < TIME('05:00:00') THEN 'Midnight'
        WHEN TIME(ss.checkin_time) >= TIME('05:00:00') AND TIME(ss.checkin_time) < TIME('12:00:00') THEN 'Morning'
        WHEN TIME(ss.checkin_time) >= TIME('12:00:00') AND TIME(ss.checkin_time) < TIME('18:00:00') THEN 'Afternoon'
        ELSE 'NightShift'
      END AS time_slot,
      ss.shift_id,
      ss.shift_name,
      ss.shift_start,
      ss.shift_end,
      ss.shift_hours,
      ss.checkin_time,
      ss.checkout_time,
      ss.break_start,
      ss.break_end,
      e.employee_id,
      e.employee_name,
      e.role_title,
      (
        SELECT p.project_name
        FROM worker_assignments wa
        INNER JOIN projects p ON p.project_id = wa.project_id
        WHERE p.company_id = p_company_id
          AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
          AND wa.employee_id = e.employee_id
          AND wa.is_active = 1
          AND cald.schedule_date >= wa.assigned_date
          AND (wa.unassigned_date IS NULL OR cald.schedule_date < wa.unassigned_date)
        ORDER BY wa.assigned_date DESC, wa.worker_assignment_id DESC
        LIMIT 1
      ) AS project_site
    FROM (
      SELECT DATE_ADD(p_month_first, INTERVAL seq.n DAY) AS schedule_date
      FROM (
        SELECT 0 AS n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION
        SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION
        SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29 UNION
        SELECT 30 UNION SELECT 31
      ) seq
    ) cald
    INNER JOIN shift_schedules ss ON ss.company_id = p_company_id
      AND (p_branch_id IS NULL OR ss.branch_id = p_branch_id)
      AND cald.schedule_date BETWEEN ss.shift_start AND ss.shift_end
    INNER JOIN employees e ON e.employee_id = ss.employee_id
      AND e.company_id = p_company_id
      AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
    WHERE cald.schedule_date <= v_last
      AND cald.schedule_date >= p_month_first
    ORDER BY cald.schedule_date,
      FIELD(
        CASE
          WHEN TIME(ss.checkin_time) >= TIME('00:00:00') AND TIME(ss.checkin_time) < TIME('05:00:00') THEN 'Midnight'
          WHEN TIME(ss.checkin_time) >= TIME('05:00:00') AND TIME(ss.checkin_time) < TIME('12:00:00') THEN 'Morning'
          WHEN TIME(ss.checkin_time) >= TIME('12:00:00') AND TIME(ss.checkin_time) < TIME('18:00:00') THEN 'Afternoon'
          ELSE 'NightShift'
        END,
        'Midnight', 'Morning', 'Afternoon', 'NightShift'
      ),
      e.employee_name;
  END`,
  `CREATE PROCEDURE construction_spWorkforceScheduleRange(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_range_start DATE,
    IN p_range_end DATE
  )
  BEGIN
    SELECT
      cald.schedule_date,
      CASE
        WHEN TIME(ss.checkin_time) >= TIME('00:00:00') AND TIME(ss.checkin_time) < TIME('05:00:00') THEN 'Midnight'
        WHEN TIME(ss.checkin_time) >= TIME('05:00:00') AND TIME(ss.checkin_time) < TIME('12:00:00') THEN 'Morning'
        WHEN TIME(ss.checkin_time) >= TIME('12:00:00') AND TIME(ss.checkin_time) < TIME('18:00:00') THEN 'Afternoon'
        ELSE 'NightShift'
      END AS time_slot,
      ss.shift_id,
      ss.shift_name,
      ss.shift_start,
      ss.shift_end,
      ss.shift_hours,
      ss.checkin_time,
      ss.checkout_time,
      ss.break_start,
      ss.break_end,
      e.employee_id,
      e.employee_name,
      e.role_title,
      (
        SELECT p.project_name
        FROM worker_assignments wa
        INNER JOIN projects p ON p.project_id = wa.project_id
        WHERE p.company_id = p_company_id
          AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
          AND wa.employee_id = e.employee_id
          AND wa.is_active = 1
          AND cald.schedule_date >= wa.assigned_date
          AND (wa.unassigned_date IS NULL OR cald.schedule_date < wa.unassigned_date)
        ORDER BY wa.assigned_date DESC, wa.worker_assignment_id DESC
        LIMIT 1
      ) AS project_site
    FROM (
      SELECT DATE_ADD(p_range_start, INTERVAL seq.n DAY) AS schedule_date
      FROM (
        ${workforceScheduleDaySeqSql}
      ) seq
    ) cald
    INNER JOIN shift_schedules ss ON ss.company_id = p_company_id
      AND (p_branch_id IS NULL OR ss.branch_id = p_branch_id)
      AND cald.schedule_date BETWEEN ss.shift_start AND ss.shift_end
    INNER JOIN employees e ON e.employee_id = ss.employee_id
      AND e.company_id = p_company_id
      AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
    WHERE cald.schedule_date <= p_range_end
      AND cald.schedule_date >= p_range_start
    ORDER BY cald.schedule_date,
      FIELD(
        CASE
          WHEN TIME(ss.checkin_time) >= TIME('00:00:00') AND TIME(ss.checkin_time) < TIME('05:00:00') THEN 'Midnight'
          WHEN TIME(ss.checkin_time) >= TIME('05:00:00') AND TIME(ss.checkin_time) < TIME('12:00:00') THEN 'Morning'
          WHEN TIME(ss.checkin_time) >= TIME('12:00:00') AND TIME(ss.checkin_time) < TIME('18:00:00') THEN 'Afternoon'
          ELSE 'NightShift'
        END,
        'Midnight', 'Morning', 'Afternoon', 'NightShift'
      ),
      e.employee_name;
  END`,
  `CREATE PROCEDURE construction_spSupplierUpsert(
    IN p_supplier_id BIGINT,
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_supplier_name VARCHAR(180),
    IN p_contact_person VARCHAR(120),
    IN p_phone VARCHAR(30),
    IN p_email VARCHAR(180),
    IN p_is_active TINYINT
  )
  BEGIN
    IF p_supplier_id IS NULL OR p_supplier_id = 0 THEN
      INSERT INTO suppliers (company_id, branch_id, supplier_name, contact_person, phone, email, is_active)
      VALUES (p_company_id, p_branch_id, p_supplier_name, p_contact_person, p_phone, p_email, IFNULL(p_is_active, 1));
      SELECT LAST_INSERT_ID() AS supplier_id;
    ELSE
      UPDATE suppliers
      SET
        branch_id = p_branch_id,
        supplier_name = p_supplier_name,
        contact_person = p_contact_person,
        phone = p_phone,
        email = p_email,
        is_active = IFNULL(p_is_active, is_active)
      WHERE supplier_id = p_supplier_id AND company_id = p_company_id;
      SELECT p_supplier_id AS supplier_id;
    END IF;
  END`,
  `CREATE PROCEDURE construction_spSuppliersList(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_search VARCHAR(200)
  )
  BEGIN
    SELECT *
    FROM suppliers s
    WHERE s.company_id = p_company_id
      AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
      AND (
        p_search IS NULL OR p_search = ''
        OR (s.supplier_name COLLATE utf8mb4_unicode_ci) LIKE CONCAT('%', p_search COLLATE utf8mb4_unicode_ci, '%')
        OR (s.contact_person COLLATE utf8mb4_unicode_ci) LIKE CONCAT('%', p_search COLLATE utf8mb4_unicode_ci, '%')
      )
    ORDER BY s.supplier_name;
  END`,
  `CREATE PROCEDURE construction_spMaterialUpsert(
    IN p_material_id BIGINT,
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_material_code VARCHAR(80),
    IN p_material_name VARCHAR(180),
    IN p_category VARCHAR(120),
    IN p_unit VARCHAR(30),
    IN p_min_stock_qty DECIMAL(12,2),
    IN p_unit_cost DECIMAL(12,2),
    IN p_supplier_id BIGINT,
    IN p_is_active TINYINT
  )
  BEGIN
    DECLARE v_material_id BIGINT DEFAULT 0;
    IF p_material_id IS NULL OR p_material_id = 0 THEN
      INSERT INTO materials (
        company_id, branch_id, material_code, material_name, category, unit, min_stock_qty, unit_cost, supplier_id, is_active
      ) VALUES (
        p_company_id, p_branch_id, p_material_code, p_material_name, p_category, IFNULL(p_unit, 'pcs'),
        IFNULL(p_min_stock_qty, 0), IFNULL(p_unit_cost, 0), p_supplier_id, IFNULL(p_is_active, 1)
      );
      SET v_material_id = LAST_INSERT_ID();
      INSERT INTO inventory (company_id, branch_id, material_id, quantity_on_hand, avg_unit_cost, last_movement_at)
      VALUES (p_company_id, p_branch_id, v_material_id, 0, IFNULL(p_unit_cost, 0), CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE avg_unit_cost = VALUES(avg_unit_cost);
      SELECT v_material_id AS material_id;
    ELSE
      UPDATE materials
      SET
        branch_id = p_branch_id,
        material_code = p_material_code,
        material_name = p_material_name,
        category = p_category,
        unit = IFNULL(p_unit, unit),
        min_stock_qty = IFNULL(p_min_stock_qty, min_stock_qty),
        unit_cost = IFNULL(p_unit_cost, unit_cost),
        supplier_id = p_supplier_id,
        is_active = IFNULL(p_is_active, is_active)
      WHERE material_id = p_material_id AND company_id = p_company_id;
      UPDATE inventory
      SET avg_unit_cost = IFNULL(p_unit_cost, avg_unit_cost)
      WHERE company_id = p_company_id AND branch_id = p_branch_id AND material_id = p_material_id;
      SELECT p_material_id AS material_id;
    END IF;
  END`,
  `CREATE PROCEDURE construction_spInventoryAdjust(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_material_id BIGINT,
    IN p_delta_qty DECIMAL(12,2),
    IN p_unit_cost DECIMAL(12,2)
  )
  BEGIN
    INSERT INTO inventory (company_id, branch_id, material_id, quantity_on_hand, avg_unit_cost, last_movement_at)
    VALUES (p_company_id, p_branch_id, p_material_id, 0, IFNULL(p_unit_cost, 0), CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE inventory_id = inventory_id;

    UPDATE inventory
    SET
      quantity_on_hand = GREATEST(quantity_on_hand + IFNULL(p_delta_qty, 0), 0),
      avg_unit_cost = CASE
        WHEN p_unit_cost IS NULL THEN avg_unit_cost
        ELSE p_unit_cost
      END,
      last_movement_at = CURRENT_TIMESTAMP
    WHERE company_id = p_company_id AND branch_id = p_branch_id AND material_id = p_material_id;

    SELECT quantity_on_hand, avg_unit_cost
    FROM inventory
    WHERE company_id = p_company_id AND branch_id = p_branch_id AND material_id = p_material_id
    LIMIT 1;
  END`,
  `CREATE PROCEDURE construction_spInventoryList(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_search VARCHAR(200)
  )
  BEGIN
    SELECT
      m.material_id,
      m.material_code,
      m.material_name,
      m.category,
      m.unit,
      m.min_stock_qty,
      m.unit_cost,
      s.supplier_name,
      IFNULL(i.quantity_on_hand, 0) AS quantity_on_hand,
      IFNULL(i.avg_unit_cost, m.unit_cost) AS avg_unit_cost,
      (IFNULL(i.quantity_on_hand, 0) * IFNULL(i.avg_unit_cost, m.unit_cost)) AS stock_value,
      CASE WHEN IFNULL(i.quantity_on_hand, 0) <= m.min_stock_qty THEN 1 ELSE 0 END AS low_stock
    FROM materials m
    LEFT JOIN inventory i ON i.company_id = m.company_id AND i.branch_id = m.branch_id AND i.material_id = m.material_id
    LEFT JOIN suppliers s ON s.supplier_id = m.supplier_id
    WHERE m.company_id = p_company_id
      AND (p_branch_id IS NULL OR m.branch_id = p_branch_id)
      AND m.is_active = 1
      AND (
        p_search IS NULL OR p_search = ''
        OR (m.material_name COLLATE utf8mb4_unicode_ci) LIKE CONCAT('%', p_search COLLATE utf8mb4_unicode_ci, '%')
        OR (m.material_code COLLATE utf8mb4_unicode_ci) LIKE CONCAT('%', p_search COLLATE utf8mb4_unicode_ci, '%')
      )
    ORDER BY m.material_name;
  END`,
  `CREATE PROCEDURE construction_spMaterialUsageLog(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_project_id BIGINT,
    IN p_material_id BIGINT,
    IN p_quantity_used DECIMAL(12,2),
    IN p_usage_date DATE,
    IN p_notes VARCHAR(500),
    IN p_created_by INT
  )
  BEGIN
    CALL construction_spInventoryAdjust(p_company_id, p_branch_id, p_material_id, -ABS(p_quantity_used), NULL);
    INSERT INTO material_usage (
      company_id, branch_id, project_id, material_id, quantity_used, usage_date, notes, created_by
    ) VALUES (
      p_company_id, p_branch_id, p_project_id, p_material_id, ABS(p_quantity_used), p_usage_date, p_notes, p_created_by
    );
    SELECT LAST_INSERT_ID() AS usage_id;
  END`,
  `CREATE PROCEDURE construction_spPurchaseOrderCreate(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_supplier_id BIGINT,
    IN p_po_number VARCHAR(80),
    IN p_order_date DATE,
    IN p_expected_date DATE,
    IN p_notes VARCHAR(500),
    IN p_material_id BIGINT,
    IN p_quantity DECIMAL(12,2),
    IN p_unit_cost DECIMAL(12,2),
    IN p_created_by INT
  )
  BEGIN
    DECLARE v_po_id BIGINT DEFAULT 0;
    DECLARE v_line_total DECIMAL(14,2) DEFAULT IFNULL(p_quantity,0) * IFNULL(p_unit_cost,0);

    INSERT INTO purchase_orders (
      company_id, branch_id, po_number, supplier_id, status, order_date, expected_date, notes, total_amount, created_by
    ) VALUES (
      p_company_id, p_branch_id, p_po_number, p_supplier_id, 'Draft', p_order_date, p_expected_date, p_notes, v_line_total, p_created_by
    );
    SET v_po_id = LAST_INSERT_ID();

    INSERT INTO purchase_order_items (po_id, material_id, quantity, unit_cost, line_total)
    VALUES (v_po_id, p_material_id, p_quantity, p_unit_cost, v_line_total);

    SELECT v_po_id AS po_id;
  END`,
  `CREATE PROCEDURE construction_spPurchaseOrdersList(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_status VARCHAR(20)
  )
  BEGIN
    SELECT
      po.po_id,
      po.po_number,
      po.status,
      po.order_date,
      po.expected_date,
      po.total_amount,
      s.supplier_name,
      poi.material_id,
      m.material_name,
      poi.quantity,
      poi.unit_cost
    FROM purchase_orders po
    LEFT JOIN suppliers s ON s.supplier_id = po.supplier_id
    LEFT JOIN purchase_order_items poi ON poi.po_id = po.po_id
    LEFT JOIN materials m ON m.material_id = poi.material_id
    WHERE po.company_id = p_company_id
      AND (p_branch_id IS NULL OR po.branch_id = p_branch_id)
      AND (p_status IS NULL OR p_status = '' OR po.status = p_status)
    ORDER BY po.po_id DESC;
  END`,
  `CREATE PROCEDURE construction_spAutoLowStockDraftPo(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_created_by INT
  )
  BEGIN
    DECLARE done INT DEFAULT 0;
    DECLARE v_material_id BIGINT;
    DECLARE v_supplier_id BIGINT;
    DECLARE v_need_qty DECIMAL(12,2);
    DECLARE v_unit_cost DECIMAL(12,2);
    DECLARE v_po_number VARCHAR(80);
    DECLARE cur CURSOR FOR
      SELECT
        m.material_id,
        m.supplier_id,
        GREATEST(m.min_stock_qty - IFNULL(i.quantity_on_hand,0), 0) AS need_qty,
        IFNULL(i.avg_unit_cost, m.unit_cost) AS unit_cost
      FROM materials m
      LEFT JOIN inventory i ON i.company_id = m.company_id AND i.branch_id = m.branch_id AND i.material_id = m.material_id
      WHERE m.company_id = p_company_id
        AND (p_branch_id IS NULL OR m.branch_id = p_branch_id)
        AND m.is_active = 1
        AND IFNULL(i.quantity_on_hand,0) <= m.min_stock_qty;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

    OPEN cur;
    read_loop: LOOP
      FETCH cur INTO v_material_id, v_supplier_id, v_need_qty, v_unit_cost;
      IF done = 1 THEN
        LEAVE read_loop;
      END IF;
      IF v_need_qty > 0 THEN
        SET v_po_number = CONCAT('AUTO-PO-', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), '-', v_material_id);
        CALL construction_spPurchaseOrderCreate(
          p_company_id,
          p_branch_id,
          v_supplier_id,
          v_po_number,
          CURDATE(),
          DATE_ADD(CURDATE(), INTERVAL 7 DAY),
          'Auto-generated low stock draft',
          v_material_id,
          v_need_qty,
          IFNULL(v_unit_cost,0),
          p_created_by
        );
      END IF;
    END LOOP;
    CLOSE cur;

    SELECT 'Auto draft generation completed' AS message;
  END`,
  `CREATE PROCEDURE construction_spInspectionUpsert(
    IN p_inspection_id BIGINT,
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_project_id BIGINT,
    IN p_inspection_type VARCHAR(30),
    IN p_title VARCHAR(200),
    IN p_inspection_date DATE,
    IN p_status VARCHAR(30),
    IN p_overall_result VARCHAR(30),
    IN p_notes TEXT,
    IN p_inspector_user_id INT,
    IN p_actor_user_id INT
  )
  BEGIN
    DECLARE v_type ENUM('Site','Safety','Quality','Other');
    DECLARE v_status ENUM('Draft','In Progress','Completed','Cancelled');
    DECLARE v_result ENUM('Pass','Conditional','Fail','NA');
    SET v_type = IFNULL(NULLIF(p_inspection_type, ''), 'Site');
    SET v_status = IFNULL(NULLIF(p_status, ''), 'Draft');
    SET v_result = CASE
      WHEN p_overall_result IS NULL OR p_overall_result = '' THEN NULL
      ELSE p_overall_result
    END;

    IF p_inspection_id IS NULL OR p_inspection_id = 0 THEN
      INSERT INTO construction_inspections (
        company_id, branch_id, project_id, inspection_type, title, inspection_date,
        status, overall_result, notes, inspector_user_id, created_by, updated_by
      ) VALUES (
        p_company_id, p_branch_id, p_project_id, v_type, p_title, p_inspection_date,
        v_status, v_result, p_notes, p_inspector_user_id, p_actor_user_id, p_actor_user_id
      );
      SELECT LAST_INSERT_ID() AS inspection_id;
    ELSE
      UPDATE construction_inspections SET
        branch_id = p_branch_id,
        project_id = p_project_id,
        inspection_type = v_type,
        title = p_title,
        inspection_date = p_inspection_date,
        status = v_status,
        overall_result = v_result,
        notes = p_notes,
        inspector_user_id = p_inspector_user_id,
        updated_by = p_actor_user_id
      WHERE inspection_id = p_inspection_id AND company_id = p_company_id;
      SELECT p_inspection_id AS inspection_id;
    END IF;
  END`,
  `CREATE PROCEDURE construction_spInspectionsList(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_status VARCHAR(30),
    IN p_project_id BIGINT,
    IN p_search VARCHAR(200),
    IN p_page_number INT,
    IN p_page_size INT
  )
  BEGIN
    DECLARE v_offset INT DEFAULT (GREATEST(IFNULL(p_page_number,1),1) - 1) * GREATEST(IFNULL(p_page_size,20),1);
    DECLARE v_page_size INT DEFAULT GREATEST(IFNULL(p_page_size,20),1);
    DECLARE v_status VARCHAR(30);
    DECLARE v_search VARCHAR(200);

    SET v_status = IFNULL(p_status, '');
    SET v_search = IFNULL(p_search, '');

    SELECT COUNT(*) AS totalRecords
    FROM construction_inspections i
    WHERE i.company_id = p_company_id
      AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
      AND (p_project_id IS NULL OR i.project_id = p_project_id)
      AND (
        v_status = ''
        OR (i.status COLLATE utf8mb4_0900_ai_ci) = (v_status COLLATE utf8mb4_0900_ai_ci)
      )
      AND (
        v_search = ''
        OR (i.title COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
      );

    SELECT
      i.inspection_id,
      i.company_id,
      i.branch_id,
      i.project_id,
      i.inspection_type,
      i.title,
      i.inspection_date,
      i.status,
      i.overall_result,
      i.inspector_user_id,
      i.created_at,
      i.updated_at
    FROM construction_inspections i
    WHERE i.company_id = p_company_id
      AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
      AND (p_project_id IS NULL OR i.project_id = p_project_id)
      AND (
        v_status = ''
        OR (i.status COLLATE utf8mb4_0900_ai_ci) = (v_status COLLATE utf8mb4_0900_ai_ci)
      )
      AND (
        v_search = ''
        OR (i.title COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
      )
    ORDER BY i.inspection_date DESC, i.inspection_id DESC
    LIMIT v_page_size OFFSET v_offset;
  END`,
  `CREATE PROCEDURE construction_spInspectionItemUpsert(
    IN p_item_id BIGINT,
    IN p_inspection_id BIGINT,
    IN p_company_id INT,
    IN p_category VARCHAR(120),
    IN p_checklist_label VARCHAR(240),
    IN p_sort_order INT,
    IN p_result VARCHAR(10),
    IN p_comments VARCHAR(500)
  )
  BEGIN
    DECLARE v_result ENUM('Pass','Fail','NA');
    SET v_result = IFNULL(NULLIF(p_result, ''), 'NA');

    IF EXISTS (SELECT 1 FROM construction_inspections WHERE inspection_id = p_inspection_id AND company_id = p_company_id) THEN
      IF p_item_id IS NULL OR p_item_id = 0 THEN
        INSERT INTO construction_inspection_items (inspection_id, category, checklist_label, sort_order, result, comments)
        VALUES (p_inspection_id, p_category, p_checklist_label, IFNULL(p_sort_order, 0), v_result, p_comments);
        SELECT LAST_INSERT_ID() AS item_id;
      ELSE
        UPDATE construction_inspection_items ii
        INNER JOIN construction_inspections i ON i.inspection_id = ii.inspection_id
        SET
          ii.category = p_category,
          ii.checklist_label = p_checklist_label,
          ii.sort_order = IFNULL(p_sort_order, ii.sort_order),
          ii.result = v_result,
          ii.comments = p_comments
        WHERE ii.item_id = p_item_id AND i.company_id = p_company_id;
        SELECT p_item_id AS item_id;
      END IF;
    ELSE
      SELECT 0 AS item_id;
    END IF;
  END`,
  `CREATE PROCEDURE construction_spInspectionIssueUpsert(
    IN p_issue_id BIGINT,
    IN p_inspection_id BIGINT,
    IN p_company_id INT,
    IN p_item_id BIGINT,
    IN p_severity VARCHAR(20),
    IN p_defect_type VARCHAR(120),
    IN p_description TEXT,
    IN p_status VARCHAR(30),
    IN p_reported_by INT
  )
  BEGIN
    DECLARE v_severity ENUM('Low','Medium','High','Critical');
    DECLARE v_status ENUM('Open','In Progress','Resolved','Closed');
    SET v_severity = IFNULL(NULLIF(p_severity, ''), 'Medium');
    SET v_status = IFNULL(NULLIF(p_status, ''), 'Open');

    IF EXISTS (SELECT 1 FROM construction_inspections WHERE inspection_id = p_inspection_id AND company_id = p_company_id) THEN
      IF p_issue_id IS NULL OR p_issue_id = 0 THEN
        INSERT INTO construction_inspection_issues (
          inspection_id, item_id, severity, defect_type, description, status, reported_by
        ) VALUES (
          p_inspection_id, p_item_id, v_severity, p_defect_type, p_description, v_status, p_reported_by
        );
        SELECT LAST_INSERT_ID() AS issue_id;
      ELSE
        UPDATE construction_inspection_issues iss
        INNER JOIN construction_inspections i ON i.inspection_id = iss.inspection_id
        SET
          iss.item_id = p_item_id,
          iss.severity = v_severity,
          iss.defect_type = p_defect_type,
          iss.description = p_description,
          iss.status = v_status
        WHERE iss.issue_id = p_issue_id AND i.company_id = p_company_id;
        SELECT p_issue_id AS issue_id;
      END IF;
    ELSE
      SELECT 0 AS issue_id;
    END IF;
  END`,
  `CREATE PROCEDURE construction_spInspectionIssueStatus(
    IN p_issue_id BIGINT,
    IN p_company_id INT,
    IN p_status VARCHAR(30)
  )
  BEGIN
    DECLARE v_status ENUM('Open','In Progress','Resolved','Closed');
    SET v_status = p_status;

    UPDATE construction_inspection_issues iss
    INNER JOIN construction_inspections i ON i.inspection_id = iss.inspection_id
    SET iss.status = v_status
    WHERE iss.issue_id = p_issue_id AND i.company_id = p_company_id;

    SELECT ROW_COUNT() AS affected;
  END`,
  `CREATE PROCEDURE construction_spInspectionImageInsert(
    IN p_inspection_id BIGINT,
    IN p_company_id INT,
    IN p_issue_id BIGINT,
    IN p_file_path VARCHAR(500),
    IN p_caption VARCHAR(240),
    IN p_uploaded_by INT
  )
  BEGIN
    IF EXISTS (SELECT 1 FROM construction_inspections WHERE inspection_id = p_inspection_id AND company_id = p_company_id) THEN
      INSERT INTO construction_inspection_images (inspection_id, issue_id, file_path, caption, uploaded_by)
      VALUES (
        p_inspection_id,
        p_issue_id,
        p_file_path,
        p_caption,
        p_uploaded_by
      );
      SELECT LAST_INSERT_ID() AS image_id;
    ELSE
      SELECT 0 AS image_id;
    END IF;
  END`,
  `CREATE PROCEDURE construction_spBudgetUpsert(
    IN p_budget_id BIGINT,
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_project_id BIGINT,
    IN p_budget_name VARCHAR(200),
    IN p_period_start DATE,
    IN p_period_end DATE,
    IN p_amount_budgeted DECIMAL(14,2),
    IN p_alert_threshold_percent DECIMAL(5,2),
    IN p_notes VARCHAR(500),
    IN p_actor_user_id INT
  )
  BEGIN
    IF p_budget_id IS NULL OR p_budget_id = 0 THEN
      INSERT INTO construction_budgets (
        company_id, branch_id, project_id, budget_name, period_start, period_end,
        amount_budgeted, alert_threshold_percent, notes, created_by
      ) VALUES (
        p_company_id, p_branch_id, p_project_id, p_budget_name, p_period_start, p_period_end,
        IFNULL(p_amount_budgeted, 0), IFNULL(p_alert_threshold_percent, 90), p_notes, p_actor_user_id
      );
      SELECT LAST_INSERT_ID() AS budget_id;
    ELSE
      UPDATE construction_budgets SET
        branch_id = p_branch_id,
        project_id = p_project_id,
        budget_name = p_budget_name,
        period_start = p_period_start,
        period_end = p_period_end,
        amount_budgeted = IFNULL(p_amount_budgeted, amount_budgeted),
        alert_threshold_percent = IFNULL(p_alert_threshold_percent, alert_threshold_percent),
        notes = p_notes
      WHERE budget_id = p_budget_id AND company_id = p_company_id;
      SELECT p_budget_id AS budget_id;
    END IF;
  END`,
  `CREATE PROCEDURE construction_spBudgetsList(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_search VARCHAR(200)
  )
  BEGIN
    SELECT *
    FROM construction_budgets b
    WHERE b.company_id = p_company_id
      AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
      AND (
        p_search IS NULL OR p_search = ''
        OR (b.budget_name COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', p_search COLLATE utf8mb4_0900_ai_ci, '%')
      )
    ORDER BY b.period_end DESC, b.budget_id DESC;
  END`,
  `CREATE PROCEDURE construction_spExpenseUpsert(
    IN p_expense_id BIGINT,
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_project_id BIGINT,
    IN p_budget_id BIGINT,
    IN p_category VARCHAR(120),
    IN p_description VARCHAR(500),
    IN p_amount DECIMAL(14,2),
    IN p_expense_date DATE,
    IN p_payee VARCHAR(200),
    IN p_status VARCHAR(20),
    IN p_actor_user_id INT
  )
  BEGIN
    DECLARE v_status ENUM('Draft','Approved','Rejected');
    SET v_status = IFNULL(NULLIF(p_status, ''), 'Draft');

    IF p_expense_id IS NULL OR p_expense_id = 0 THEN
      INSERT INTO construction_expenses (
        company_id, branch_id, project_id, budget_id, category, description,
        amount, expense_date, payee, status, created_by
      ) VALUES (
        p_company_id, p_branch_id, p_project_id, p_budget_id, p_category, p_description,
        p_amount, p_expense_date, p_payee, v_status, p_actor_user_id
      );
      SELECT LAST_INSERT_ID() AS expense_id;
    ELSE
      UPDATE construction_expenses SET
        branch_id = p_branch_id,
        project_id = p_project_id,
        budget_id = p_budget_id,
        category = p_category,
        description = p_description,
        amount = p_amount,
        expense_date = p_expense_date,
        payee = p_payee,
        status = v_status
      WHERE expense_id = p_expense_id AND company_id = p_company_id;
      SELECT p_expense_id AS expense_id;
    END IF;
  END`,
  `CREATE PROCEDURE construction_spExpensesList(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_status VARCHAR(20),
    IN p_search VARCHAR(200),
    IN p_page_number INT,
    IN p_page_size INT
  )
  BEGIN
    DECLARE v_offset INT DEFAULT (GREATEST(IFNULL(p_page_number,1),1) - 1) * GREATEST(IFNULL(p_page_size,20),1);
    DECLARE v_page_size INT DEFAULT GREATEST(IFNULL(p_page_size,20),1);
    DECLARE v_status VARCHAR(20);
    DECLARE v_search VARCHAR(200);
    SET v_status = IFNULL(p_status, '');
    SET v_search = IFNULL(p_search, '');

    SELECT COUNT(*) AS totalRecords
    FROM construction_expenses e
    WHERE e.company_id = p_company_id
      AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
      AND (
        v_status = ''
        OR (e.status COLLATE utf8mb4_0900_ai_ci) = (v_status COLLATE utf8mb4_0900_ai_ci)
      )
      AND (
        v_search = ''
        OR (e.description COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
        OR (IFNULL(e.payee, '') COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
      );

    SELECT *
    FROM construction_expenses e
    WHERE e.company_id = p_company_id
      AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
      AND (
        v_status = ''
        OR (e.status COLLATE utf8mb4_0900_ai_ci) = (v_status COLLATE utf8mb4_0900_ai_ci)
      )
      AND (
        v_search = ''
        OR (e.description COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
        OR (IFNULL(e.payee, '') COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
      )
    ORDER BY e.expense_date DESC, e.expense_id DESC
    LIMIT v_page_size OFFSET v_offset;
  END`,
  `CREATE PROCEDURE construction_spInvoiceUpsert(
    IN p_invoice_id BIGINT,
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_project_id BIGINT,
    IN p_invoice_number VARCHAR(80),
    IN p_counterparty_name VARCHAR(200),
    IN p_invoice_direction VARCHAR(20),
    IN p_amount DECIMAL(14,2),
    IN p_tax_amount DECIMAL(14,2),
    IN p_total_amount DECIMAL(14,2),
    IN p_issue_date DATE,
    IN p_due_date DATE,
    IN p_status VARCHAR(30),
    IN p_notes VARCHAR(500),
    IN p_actor_user_id INT
  )
  BEGIN
    DECLARE v_dir ENUM('Receivable','Payable');
    DECLARE v_status ENUM('Draft','Sent','Partial','Paid','Overdue','Cancelled');
    SET v_dir = IFNULL(NULLIF(p_invoice_direction, ''), 'Receivable');
    SET v_status = IFNULL(NULLIF(p_status, ''), 'Draft');

    IF p_invoice_id IS NULL OR p_invoice_id = 0 THEN
      INSERT INTO construction_invoices (
        company_id, branch_id, project_id, invoice_number, counterparty_name, invoice_direction,
        amount, tax_amount, total_amount, issue_date, due_date, status, notes, created_by
      ) VALUES (
        p_company_id, p_branch_id, p_project_id, p_invoice_number, p_counterparty_name, v_dir,
        IFNULL(p_amount, 0), IFNULL(p_tax_amount, 0), IFNULL(p_total_amount, 0),
        p_issue_date, p_due_date, v_status, p_notes, p_actor_user_id
      );
      SELECT LAST_INSERT_ID() AS invoice_id;
    ELSE
      UPDATE construction_invoices SET
        branch_id = p_branch_id,
        project_id = p_project_id,
        invoice_number = p_invoice_number,
        counterparty_name = p_counterparty_name,
        invoice_direction = v_dir,
        amount = IFNULL(p_amount, amount),
        tax_amount = IFNULL(p_tax_amount, tax_amount),
        total_amount = IFNULL(p_total_amount, total_amount),
        issue_date = p_issue_date,
        due_date = p_due_date,
        status = v_status,
        notes = p_notes
      WHERE invoice_id = p_invoice_id AND company_id = p_company_id;
      SELECT p_invoice_id AS invoice_id;
    END IF;
  END`,
  `CREATE PROCEDURE construction_spInvoicesList(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_direction VARCHAR(20),
    IN p_status VARCHAR(30),
    IN p_search VARCHAR(200),
    IN p_page_number INT,
    IN p_page_size INT
  )
  BEGIN
    DECLARE v_offset INT DEFAULT (GREATEST(IFNULL(p_page_number,1),1) - 1) * GREATEST(IFNULL(p_page_size,20),1);
    DECLARE v_page_size INT DEFAULT GREATEST(IFNULL(p_page_size,20),1);
    DECLARE v_dir VARCHAR(20);
    DECLARE v_status VARCHAR(30);
    DECLARE v_search VARCHAR(200);
    SET v_dir = IFNULL(p_direction, '');
    SET v_status = IFNULL(p_status, '');
    SET v_search = IFNULL(p_search, '');

    SELECT COUNT(*) AS totalRecords
    FROM construction_invoices i
    WHERE i.company_id = p_company_id
      AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
      AND (
        v_dir = ''
        OR (i.invoice_direction COLLATE utf8mb4_0900_ai_ci) = (v_dir COLLATE utf8mb4_0900_ai_ci)
      )
      AND (
        v_status = ''
        OR (i.status COLLATE utf8mb4_0900_ai_ci) = (v_status COLLATE utf8mb4_0900_ai_ci)
      )
      AND (
        v_search = ''
        OR (i.invoice_number COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
        OR (i.counterparty_name COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
      );

    SELECT *
    FROM construction_invoices i
    WHERE i.company_id = p_company_id
      AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
      AND (
        v_dir = ''
        OR (i.invoice_direction COLLATE utf8mb4_0900_ai_ci) = (v_dir COLLATE utf8mb4_0900_ai_ci)
      )
      AND (
        v_status = ''
        OR (i.status COLLATE utf8mb4_0900_ai_ci) = (v_status COLLATE utf8mb4_0900_ai_ci)
      )
      AND (
        v_search = ''
        OR (i.invoice_number COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
        OR (i.counterparty_name COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
      )
    ORDER BY i.issue_date DESC, i.invoice_id DESC
    LIMIT v_page_size OFFSET v_offset;
  END`,
  `CREATE PROCEDURE construction_spPaymentUpsert(
    IN p_payment_id BIGINT,
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_invoice_id BIGINT,
    IN p_budget_id BIGINT,
    IN p_payee_name VARCHAR(200),
    IN p_payment_category VARCHAR(30),
    IN p_amount DECIMAL(14,2),
    IN p_payment_date DATE,
    IN p_reference_no VARCHAR(120),
    IN p_notes VARCHAR(500),
    IN p_actor_user_id INT
  )
  BEGIN
    DECLARE v_cat ENUM('Contractor','Vendor','Payroll','Other');
    SET v_cat = IFNULL(NULLIF(p_payment_category, ''), 'Vendor');

    IF p_payment_id IS NULL OR p_payment_id = 0 THEN
      INSERT INTO construction_payments (
        company_id, branch_id, invoice_id, budget_id, payee_name, payment_category,
        amount, payment_date, reference_no, notes, created_by
      ) VALUES (
        p_company_id, p_branch_id, p_invoice_id, p_budget_id, p_payee_name, v_cat,
        p_amount, p_payment_date, p_reference_no, p_notes, p_actor_user_id
      );
      SELECT LAST_INSERT_ID() AS payment_id;
    ELSE
      UPDATE construction_payments SET
        branch_id = p_branch_id,
        invoice_id = p_invoice_id,
        budget_id = p_budget_id,
        payee_name = p_payee_name,
        payment_category = v_cat,
        amount = p_amount,
        payment_date = p_payment_date,
        reference_no = p_reference_no,
        notes = p_notes
      WHERE payment_id = p_payment_id AND company_id = p_company_id;
      SELECT p_payment_id AS payment_id;
    END IF;
  END`,
  `CREATE PROCEDURE construction_spPaymentsList(
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_category VARCHAR(30),
    IN p_search VARCHAR(200),
    IN p_page_number INT,
    IN p_page_size INT
  )
  BEGIN
    DECLARE v_offset INT DEFAULT (GREATEST(IFNULL(p_page_number,1),1) - 1) * GREATEST(IFNULL(p_page_size,20),1);
    DECLARE v_page_size INT DEFAULT GREATEST(IFNULL(p_page_size,20),1);
    DECLARE v_cat VARCHAR(30);
    DECLARE v_search VARCHAR(200);
    SET v_cat = IFNULL(p_category, '');
    SET v_search = IFNULL(p_search, '');

    SELECT COUNT(*) AS totalRecords
    FROM construction_payments p
    WHERE p.company_id = p_company_id
      AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
      AND (
        v_cat = ''
        OR (p.payment_category COLLATE utf8mb4_0900_ai_ci) = (v_cat COLLATE utf8mb4_0900_ai_ci)
      )
      AND (
        v_search = ''
        OR (p.payee_name COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
        OR (IFNULL(p.reference_no, '') COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
      );

    SELECT *
    FROM construction_payments p
    WHERE p.company_id = p_company_id
      AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
      AND (
        v_cat = ''
        OR (p.payment_category COLLATE utf8mb4_0900_ai_ci) = (v_cat COLLATE utf8mb4_0900_ai_ci)
      )
      AND (
        v_search = ''
        OR (p.payee_name COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
        OR (IFNULL(p.reference_no, '') COLLATE utf8mb4_0900_ai_ci) LIKE CONCAT('%', v_search COLLATE utf8mb4_0900_ai_ci, '%')
      )
    ORDER BY p.payment_date DESC, p.payment_id DESC
    LIMIT v_page_size OFFSET v_offset;
  END`,
  `CREATE PROCEDURE construction_spFinanceKpis(
    IN p_company_id INT,
    IN p_branch_id INT
  )
  BEGIN
    SELECT
      COALESCE((
        SELECT SUM(b.amount_budgeted) FROM construction_budgets b
        WHERE b.company_id = p_company_id AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
      ), 0) AS total_budgeted,
      COALESCE((
        SELECT SUM(e.amount) FROM construction_expenses e
        WHERE e.company_id = p_company_id AND (p_branch_id IS NULL OR e.branch_id = p_branch_id)
          AND e.status = 'Approved'
      ), 0) AS total_approved_expenses,
      COALESCE((
        SELECT SUM(p.amount) FROM construction_payments p
        WHERE p.company_id = p_company_id AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
      ), 0) AS total_payments_out,
      COALESCE((
        SELECT SUM(i.total_amount) FROM construction_invoices i
        WHERE i.company_id = p_company_id AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
          AND i.invoice_direction = 'Receivable'
          AND i.status NOT IN ('Paid','Cancelled')
      ), 0) AS open_receivables,
      COALESCE((
        SELECT SUM(i.total_amount) FROM construction_invoices i
        WHERE i.company_id = p_company_id AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
          AND i.invoice_direction = 'Payable'
          AND i.status NOT IN ('Paid','Cancelled')
      ), 0) AS open_payables;

    SELECT
      b.budget_id,
      b.budget_name,
      b.period_start,
      b.period_end,
      b.amount_budgeted,
      b.alert_threshold_percent,
      (COALESCE(exp_spent.amt, 0) + COALESCE(pay_spent.amt, 0)) AS spent_amount,
      CASE
        WHEN b.amount_budgeted > 0 THEN ROUND((COALESCE(exp_spent.amt, 0) + COALESCE(pay_spent.amt, 0)) / b.amount_budgeted * 100, 2)
        ELSE NULL
      END AS utilization_pct,
      CASE
        WHEN (COALESCE(exp_spent.amt, 0) + COALESCE(pay_spent.amt, 0)) > b.amount_budgeted THEN 'Overrun'
        WHEN b.amount_budgeted > 0
          AND (COALESCE(exp_spent.amt, 0) + COALESCE(pay_spent.amt, 0)) >= b.amount_budgeted * (b.alert_threshold_percent / 100)
          THEN 'Warning'
        ELSE 'OK'
      END AS alert_status
    FROM construction_budgets b
    LEFT JOIN (
      SELECT budget_id, SUM(amount) AS amt
      FROM construction_expenses
      WHERE company_id = p_company_id
        AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        AND budget_id IS NOT NULL
        AND status = 'Approved'
      GROUP BY budget_id
    ) exp_spent ON exp_spent.budget_id = b.budget_id
    LEFT JOIN (
      SELECT budget_id, SUM(amount) AS amt
      FROM construction_payments
      WHERE company_id = p_company_id
        AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        AND budget_id IS NOT NULL
      GROUP BY budget_id
    ) pay_spent ON pay_spent.budget_id = b.budget_id
    WHERE b.company_id = p_company_id
      AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
    ORDER BY b.period_end DESC, b.budget_id DESC;
  END`,
  `CREATE PROCEDURE construction_spNotificationInsert(
    IN p_user_id INT,
    IN p_company_id INT,
    IN p_branch_id INT,
    IN p_category VARCHAR(50),
    IN p_title VARCHAR(200),
    IN p_body TEXT,
    IN p_link_path VARCHAR(240),
    IN p_severity VARCHAR(20),
    IN p_dedupe_key VARCHAR(220)
  )
  BEGIN
    DECLARE v_sev ENUM('Info','Warning','Critical');
    SET v_sev = IFNULL(NULLIF(p_severity, ''), 'Warning');
    INSERT IGNORE INTO construction_notifications (
      user_id, company_id, branch_id, category, title, body, link_path, severity, dedupe_key
    ) VALUES (
      p_user_id, p_company_id, p_branch_id, p_category, p_title, p_body, p_link_path, v_sev, p_dedupe_key
    );
    SELECT ROW_COUNT() AS inserted;
  END`,
  `CREATE PROCEDURE construction_spNotificationsList(
    IN p_user_id INT,
    IN p_unread_only TINYINT,
    IN p_limit INT
  )
  BEGIN
    DECLARE v_lim INT DEFAULT 50;
    SET v_lim = IF(IFNULL(p_limit, 0) < 1, 50, IFNULL(p_limit, 50));
    SELECT *
    FROM construction_notifications n
    WHERE n.user_id = p_user_id
      AND (
        p_unread_only IS NULL OR p_unread_only = 0 OR n.read_at IS NULL
      )
    ORDER BY n.created_at DESC
    LIMIT v_lim;
  END`,
  `CREATE PROCEDURE construction_spNotificationMarkRead(
    IN p_notification_id BIGINT,
    IN p_user_id INT
  )
  BEGIN
    UPDATE construction_notifications
    SET read_at = CURRENT_TIMESTAMP
    WHERE notification_id = p_notification_id AND user_id = p_user_id;
    SELECT ROW_COUNT() AS affected;
  END`,
  `CREATE PROCEDURE construction_spNotificationsUnreadCount(
    IN p_user_id INT
  )
  BEGIN
    SELECT COUNT(*) AS unread_count
    FROM construction_notifications
    WHERE user_id = p_user_id AND read_at IS NULL;
  END`,
];

const consEmployeeJobSeeds = [
  "Carpenter",
  "Plumber",
  "Civil Engineer",
  "Architect",
  "Surveyor",
  "Construction Manager",
  "Bricklayer",
  "Project Manager",
  "Interior Designer",
  "Painter",
  "Decorator",
  "Laborer",
  "Joiner",
  "Site Manager",
  "Production Operator",
  "Building Inspector",
  "Roofer",
  "Mason",
  "Road Maintenance",
  "Equipment Operator",
  "Welder",
  "Iron Worker",
  "Landscaper",
  "Glazier",
  "Demolition Work",
  "Electrician",
  "Estimator",
];

const run = async () => {
  try {
    for (const q of ddl) await db.query(q);
    const shiftBreakAlters = [
      "ALTER TABLE shift_schedules ADD COLUMN break_start TIME NULL AFTER checkout_time",
      "ALTER TABLE shift_schedules ADD COLUMN break_end TIME NULL AFTER break_start",
    ];
    for (const sql of shiftBreakAlters) {
      try {
        await db.query(sql);
      } catch (e) {
        const errno = e?.errno ?? e?.code;
        const msg = String(e?.message || e || "");
        if (errno !== 1060 && !/Duplicate column name/i.test(msg)) throw e;
      }
    }
    for (let i = 0; i < consEmployeeJobSeeds.length; i += 1) {
      await db.query(
        `INSERT INTO cons_employee_lookup (job_title, sort_order, is_active)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE
           sort_order = VALUES(sort_order),
           is_active = 1`,
        [consEmployeeJobSeeds[i], i + 1]
      );
    }
    for (const q of dropProcedures) await db.query(q);
    for (const q of procedures) await db.query(q);
    console.log("Construction DB tables and procedures are ready.");
    process.exit(0);
  } catch (error) {
    console.error("Construction DB setup failed:", error.message);
    process.exit(1);
  }
};

run();

