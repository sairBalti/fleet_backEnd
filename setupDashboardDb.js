import dotenv from "dotenv";
import db from "./config/db.js";

dotenv.config();

const createNotificationsTableSql = `
CREATE TABLE IF NOT EXISTS portal_notifications (
  notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id INT NULL,
  branch_id INT NULL,
  title VARCHAR(180) NOT NULL,
  message VARCHAR(255) NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'info',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id),
  INDEX idx_notifications_scope (company_id, branch_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const dropProcedureSql = "DROP PROCEDURE IF EXISTS portal_spDashboardKpiData";

const createProcedureSql = `
CREATE PROCEDURE portal_spDashboardKpiData(
  IN p_companyId INT,
  IN p_branchId INT,
  IN p_loggedInUserId INT
)
BEGIN
  DECLARE v_roleName VARCHAR(100);
  DECLARE v_userCompanyId INT;
  DECLARE v_userBranchId INT;
  DECLARE v_weekStart DATE;
  DECLARE v_weekEnd DATE;

  SELECT lr.role_name, u.company_id, u.branch_id
  INTO v_roleName, v_userCompanyId, v_userBranchId
  FROM users u
  INNER JOIN lookup_roles lr ON lr.role_id = u.role_id
  WHERE u.id = p_loggedInUserId
  LIMIT 1;

  IF v_roleName NOT IN ('SuperAdmin', 'Admin') THEN
    SET p_companyId = v_userCompanyId;
    IF v_roleName IN ('BranchManager', 'Driver') THEN
      SET p_branchId = v_userBranchId;
    END IF;
  END IF;

  SET v_weekStart = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY);
  SET v_weekEnd = DATE_ADD(v_weekStart, INTERVAL 6 DAY);

  SELECT
    (SELECT COUNT(1) FROM portal_driver_profiles dp
      WHERE dp.is_active = 1
        AND (p_companyId IS NULL OR dp.company_id = p_companyId)
        AND (p_branchId IS NULL OR dp.branch_id = p_branchId)) AS totalDrivers,
    (SELECT ROUND(
      IFNULL(
        SUM(CASE WHEN LOWER(dsp.status) IN ('route','active','in-progress','rescue') THEN 1 ELSE 0 END) / NULLIF(COUNT(1),0) * 100,
      0), 0)
      FROM portal_driver_schedule dsp
      INNER JOIN portal_driver_profiles dp ON dp.driver_id = dsp.driver_id
      WHERE dsp.schedule_date BETWEEN v_weekStart AND v_weekEnd
        AND (p_companyId IS NULL OR dp.company_id = p_companyId)
        AND (p_branchId IS NULL OR dp.branch_id = p_branchId)
    ) AS driversAttendance,
    (SELECT ROUND(IFNULL(AVG(pm.safety_score), 0), 0)
      FROM portal_driver_performance_monthly pm
      INNER JOIN portal_driver_profiles dp ON dp.driver_id = pm.driver_id
      WHERE (p_companyId IS NULL OR dp.company_id = p_companyId)
        AND (p_branchId IS NULL OR dp.branch_id = p_branchId)
    ) AS safetyScore,
    (SELECT COUNT(1) FROM vehicles v
      WHERE (p_companyId IS NULL OR v.company_id = p_companyId)
        AND (p_branchId IS NULL OR v.branch_id = p_branchId)
    ) AS totalVehicles;

  SELECT
    dp.driver_name AS label,
    ROUND(IFNULL(AVG(pm.efficiency_score), 0), 0) AS value
  FROM portal_driver_profiles dp
  LEFT JOIN portal_driver_performance_monthly pm ON pm.driver_id = dp.driver_id
  WHERE (p_companyId IS NULL OR dp.company_id = p_companyId)
    AND (p_branchId IS NULL OR dp.branch_id = p_branchId)
  GROUP BY dp.driver_id, dp.driver_name
  ORDER BY dp.driver_id
  LIMIT 8;

  SELECT
    ROUND(IFNULL(SUM(CASE WHEN LOWER(dsp.status) IN ('standby', 'rescue') THEN 1 ELSE 0 END) / NULLIF(COUNT(1),0) * 100, 0), 0) AS partially_compliant,
    ROUND(IFNULL(SUM(CASE WHEN LOWER(dsp.status) IN ('route','active','in-progress') THEN 1 ELSE 0 END) / NULLIF(COUNT(1),0) * 100, 0), 0) AS fully_compliant,
    ROUND(IFNULL(SUM(CASE WHEN LOWER(dsp.status) IN ('unavailable') THEN 1 ELSE 0 END) / NULLIF(COUNT(1),0) * 100, 0), 0) AS non_compliant
  FROM portal_driver_schedule dsp
  INNER JOIN portal_driver_profiles dp ON dp.driver_id = dsp.driver_id
  WHERE dsp.schedule_date BETWEEN v_weekStart AND v_weekEnd
    AND (p_companyId IS NULL OR dp.company_id = p_companyId)
    AND (p_branchId IS NULL OR dp.branch_id = p_branchId);

  SELECT
    dp.driver_name,
    CONCAT('#', dp.driver_id) AS lead_id,
    COALESCE(dsp.fleet_assigned, 'N/A') AS fleet_assigned,
    COALESCE(dsp.status, 'Unavailable') AS status
  FROM portal_driver_profiles dp
  LEFT JOIN portal_driver_schedule dsp
    ON dsp.driver_id = dp.driver_id
   AND dsp.schedule_date = CURDATE()
  WHERE (p_companyId IS NULL OR dp.company_id = p_companyId)
    AND (p_branchId IS NULL OR dp.branch_id = p_branchId)
  ORDER BY dp.driver_id DESC
  LIMIT 8;

  SELECT
    pn.notification_id,
    pn.title,
    pn.message,
    pn.type,
    pn.created_at
  FROM portal_notifications pn
  WHERE (pn.company_id IS NULL OR pn.company_id = p_companyId OR p_companyId IS NULL)
    AND (pn.branch_id IS NULL OR pn.branch_id = p_branchId OR p_branchId IS NULL)
  ORDER BY pn.created_at DESC
  LIMIT 10;
END
`;

const seedNotifications = async () => {
  const notifications = [
    ["Excited for new year? Get 20% special.", "Promo available for premium routing intelligence", "warning"],
    ["Your password successfully changed.", "Security update completed for your account", "info"],
    ["You received 1 new message.", "Dispatcher shared updates for tonight routes", "success"],
    ["Profile picture updated.", "Your public profile image has been refreshed", "danger"],
  ];

  for (const [title, message, type] of notifications) {
    await db.execute(
      `INSERT INTO portal_notifications (company_id, branch_id, title, message, type)
       SELECT NULL, NULL, ?, ?, ?
       FROM DUAL
       WHERE NOT EXISTS (
         SELECT 1 FROM portal_notifications WHERE title = ? AND message = ?
       )`,
      [title, message, type, title, message]
    );
  }
};

const run = async () => {
  try {
    await db.query(createNotificationsTableSql);
    await seedNotifications();
    await db.query(dropProcedureSql);
    await db.query(createProcedureSql);
    console.log("Dashboard KPI table and procedure are ready.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to setup dashboard DB objects:", error.message);
    process.exit(1);
  }
};

run();
