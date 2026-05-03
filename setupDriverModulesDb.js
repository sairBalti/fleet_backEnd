import dotenv from "dotenv";
import db from "./config/db.js";

dotenv.config();

const tableSql = [
  `CREATE TABLE IF NOT EXISTS portal_driver_profiles (
    driver_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    company_id INT NOT NULL,
    branch_id INT NOT NULL,
    driver_name VARCHAR(120) NOT NULL,
    email VARCHAR(180) NULL,
    avatar_url VARCHAR(255) NULL,
    total_driving_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_mileage DECIMAL(12,2) NOT NULL DEFAULT 0,
    efficiency_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    safety_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    completion_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    driver_status VARCHAR(40) NOT NULL DEFAULT 'Active',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (driver_id),
    INDEX idx_driver_profiles_company_branch (company_id, branch_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS portal_driver_schedule (
    schedule_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    driver_id INT UNSIGNED NOT NULL,
    schedule_date DATE NOT NULL,
    route_name VARCHAR(80) NOT NULL,
    fleet_assigned VARCHAR(80) NOT NULL,
    station VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'Route',
    work_block_rostered INT NOT NULL DEFAULT 0,
    schedule_association INT NOT NULL DEFAULT 0,
    voluntary_extra_time INT NOT NULL DEFAULT 0,
    notes VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (schedule_id),
    INDEX idx_driver_schedule_driver_date (driver_id, schedule_date),
    CONSTRAINT fk_driver_schedule_driver FOREIGN KEY (driver_id) REFERENCES portal_driver_profiles(driver_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS portal_driver_performance_monthly (
    record_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    driver_id INT UNSIGNED NOT NULL,
    period_month DATE NOT NULL,
    mileage DECIMAL(12,2) NOT NULL DEFAULT 0,
    driving_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
    efficiency_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    safety_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    completion_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (record_id),
    UNIQUE KEY uq_driver_month (driver_id, period_month),
    INDEX idx_driver_perf_driver (driver_id),
    CONSTRAINT fk_driver_perf_driver FOREIGN KEY (driver_id) REFERENCES portal_driver_profiles(driver_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const dropSpsSql = [
  "DROP PROCEDURE IF EXISTS portal_spDriverMainPageData",
  "DROP PROCEDURE IF EXISTS portal_spDriverSchedulePageData",
  "DROP PROCEDURE IF EXISTS portal_spDriverPerformancePageData",
];

const spDriverMainPageSql = `
CREATE PROCEDURE portal_spDriverMainPageData(
  IN p_companyId INT,
  IN p_branchId INT,
  IN p_statusFilter VARCHAR(50),
  IN p_searchText VARCHAR(200),
  IN p_sortColumn VARCHAR(64),
  IN p_sortDirection VARCHAR(4),
  IN p_pageNumber INT,
  IN p_pageSize INT,
  IN p_loggedInUserId INT
)
BEGIN
  DECLARE v_roleName VARCHAR(100);
  DECLARE v_userCompanyId INT;
  DECLARE v_userBranchId INT;
  DECLARE v_sortColumn VARCHAR(64) DEFAULT 'driver_name';
  DECLARE v_sortDirection VARCHAR(4) DEFAULT 'ASC';
  DECLARE v_offset INT DEFAULT 0;
  DECLARE v_orderExpr TEXT;

  SELECT lr.role_name, u.company_id, u.branch_id
  INTO v_roleName, v_userCompanyId, v_userBranchId
  FROM users u
  INNER JOIN lookup_roles lr ON lr.role_id = u.role_id
  WHERE u.id = p_loggedInUserId
  LIMIT 1;

  IF p_pageNumber IS NULL OR p_pageNumber < 1 THEN
    SET p_pageNumber = 1;
  END IF;

  IF p_pageSize IS NULL OR p_pageSize < 1 OR p_pageSize > 100 THEN
    SET p_pageSize = 20;
  END IF;

  SET v_offset = (p_pageNumber - 1) * p_pageSize;

  IF p_sortColumn IN ('driver_name', 'email', 'branch_name', 'efficiency_score', 'driver_status') THEN
    SET v_sortColumn = p_sortColumn;
  END IF;

  IF UPPER(IFNULL(p_sortDirection, 'ASC')) = 'DESC' THEN
    SET v_sortDirection = 'DESC';
  ELSE
    SET v_sortDirection = 'ASC';
  END IF;

  IF v_sortColumn = 'branch_name' THEN
    SET v_orderExpr = CONCAT('b.branch_name ', v_sortDirection);
  ELSE
    SET v_orderExpr = CONCAT('dp.', v_sortColumn, ' ', v_sortDirection);
  END IF;

  IF v_roleName NOT IN ('SuperAdmin', 'Admin') THEN
    SET p_companyId = v_userCompanyId;
    IF v_roleName IN ('BranchManager', 'Driver') THEN
      SET p_branchId = v_userBranchId;
    END IF;
  END IF;

  IF p_statusFilter IS NOT NULL AND (p_statusFilter = '' OR UPPER(TRIM(p_statusFilter)) = 'ALL') THEN
    SET p_statusFilter = NULL;
  END IF;

  IF p_searchText IS NOT NULL AND CHAR_LENGTH(TRIM(p_searchText)) > 0 THEN
    SET @likePattern = CONCAT('%', TRIM(p_searchText), '%');
  ELSE
    SET @likePattern = NULL;
  END IF;

  SET @sql_data = CONCAT(
    'SELECT ',
    'dp.driver_id AS id, dp.company_id, dp.branch_id, c.company_name, b.branch_name, ',
    'dp.driver_name, dp.email, dp.total_driving_hours, dp.total_mileage, ',
    'dp.efficiency_score, dp.safety_score, dp.completion_rate, ',
    'dp.driver_status AS status, dp.is_active, ',
    'COUNT(1) OVER() AS totalRecords ',
    'FROM portal_driver_profiles dp ',
    'INNER JOIN branches b ON b.branch_id = dp.branch_id AND b.isDeleted = 0 ',
    'INNER JOIN companies c ON c.company_id = dp.company_id ',
    'WHERE 1=1 ',
    'AND (? IS NULL OR dp.company_id = ?) ',
    'AND (? IS NULL OR dp.branch_id = ?) ',
    'AND (? IS NULL OR dp.driver_status = ?) ',
    'AND (@likePattern IS NULL OR dp.driver_name LIKE @likePattern OR dp.email LIKE @likePattern OR b.branch_name LIKE @likePattern) ',
    'ORDER BY ', v_orderExpr, ' ',
    'LIMIT ?, ?'
  );

  SET @companyId = p_companyId;
  SET @branchId = p_branchId;
  SET @statusFilter = p_statusFilter;
  SET @offset = v_offset;
  SET @limitSize = p_pageSize;

  PREPARE stmt_data FROM @sql_data;
  EXECUTE stmt_data USING
    @companyId, @companyId,
    @branchId, @branchId,
    @statusFilter, @statusFilter,
    @offset, @limitSize;
  DEALLOCATE PREPARE stmt_data;
END
`;

const spScheduleSql = `
CREATE PROCEDURE portal_spDriverSchedulePageData(
  IN p_companyId INT,
  IN p_branchId INT,
  IN p_weekStart DATE,
  IN p_searchText VARCHAR(120),
  IN p_sortColumn VARCHAR(64),
  IN p_sortDirection VARCHAR(4),
  IN p_pageNumber INT,
  IN p_pageSize INT,
  IN p_loggedInUserId INT
)
BEGIN
  DECLARE v_roleName VARCHAR(100);
  DECLARE v_userCompanyId INT;
  DECLARE v_userBranchId INT;
  DECLARE v_sortColumn VARCHAR(64) DEFAULT 'driver_name';
  DECLARE v_sortDirection VARCHAR(4) DEFAULT 'ASC';
  DECLARE v_offset INT DEFAULT 0;
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

  IF p_pageNumber IS NULL OR p_pageNumber < 1 THEN
    SET p_pageNumber = 1;
  END IF;
  IF p_pageSize IS NULL OR p_pageSize < 1 OR p_pageSize > 100 THEN
    SET p_pageSize = 20;
  END IF;
  SET v_offset = (p_pageNumber - 1) * p_pageSize;

  IF p_sortColumn IN ('driver_name','route_name','schedule_date','status') THEN
    SET v_sortColumn = p_sortColumn;
  END IF;
  IF UPPER(IFNULL(p_sortDirection,'ASC')) = 'DESC' THEN
    SET v_sortDirection = 'DESC';
  ELSE
    SET v_sortDirection = 'ASC';
  END IF;

  SET v_weekStart = IFNULL(p_weekStart, DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY));
  SET v_weekEnd = DATE_ADD(v_weekStart, INTERVAL 6 DAY);

  SELECT
    COUNT(DISTINCT dsp.driver_id) AS totalDriversScheduled,
    COUNT(DISTINCT dsp.route_name) AS totalRoutesScheduled,
    COUNT(DISTINCT CASE WHEN dsp.status = 'Route' THEN dsp.schedule_id END) AS activeRoutes
  FROM portal_driver_schedule dsp
  INNER JOIN portal_driver_profiles dp ON dp.driver_id = dsp.driver_id
  WHERE dsp.schedule_date BETWEEN v_weekStart AND v_weekEnd
    AND (p_companyId IS NULL OR dp.company_id = p_companyId)
    AND (p_branchId IS NULL OR dp.branch_id = p_branchId);

  SET @sql_data = CONCAT(
    'SELECT ',
    'dsp.schedule_id, dsp.schedule_date, dp.driver_id, dp.driver_name, dsp.route_name, dsp.fleet_assigned, ',
    'dsp.station, TIME_FORMAT(dsp.start_time, "%h:%i %p") AS start_time, TIME_FORMAT(dsp.end_time, "%h:%i %p") AS end_time, ',
    'dsp.status, dsp.work_block_rostered, dsp.schedule_association, dsp.voluntary_extra_time, ',
    'COUNT(1) OVER() AS totalRecords ',
    'FROM portal_driver_schedule dsp ',
    'INNER JOIN portal_driver_profiles dp ON dp.driver_id = dsp.driver_id ',
    'WHERE dsp.schedule_date BETWEEN ? AND ? ',
    'AND (? IS NULL OR dp.company_id = ?) ',
    'AND (? IS NULL OR dp.branch_id = ?) ',
    'AND (? IS NULL OR ? = "" OR dp.driver_name LIKE CONCAT("%", ?, "%")) ',
    'ORDER BY ', v_sortColumn, ' ', v_sortDirection, ' ',
    'LIMIT ?, ?'
  );

  SET @weekStart = v_weekStart;
  SET @weekEnd = v_weekEnd;
  SET @companyId = p_companyId;
  SET @branchId = p_branchId;
  SET @searchText = p_searchText;
  SET @offset = v_offset;
  SET @limitSize = p_pageSize;

  PREPARE stmt_data FROM @sql_data;
  EXECUTE stmt_data USING
    @weekStart, @weekEnd,
    @companyId, @companyId,
    @branchId, @branchId,
    @searchText, @searchText, @searchText,
    @offset, @limitSize;
  DEALLOCATE PREPARE stmt_data;

  SELECT
    schedule_date,
    SUM(work_block_rostered) AS workBlocks,
    SUM(schedule_association) AS associations,
    SUM(voluntary_extra_time) AS extraTime
  FROM portal_driver_schedule dsp
  INNER JOIN portal_driver_profiles dp ON dp.driver_id = dsp.driver_id
  WHERE dsp.schedule_date BETWEEN v_weekStart AND v_weekEnd
    AND (p_companyId IS NULL OR dp.company_id = p_companyId)
    AND (p_branchId IS NULL OR dp.branch_id = p_branchId)
  GROUP BY schedule_date
  ORDER BY schedule_date;
END
`;

const spPerformanceSql = `
CREATE PROCEDURE portal_spDriverPerformancePageData(
  IN p_companyId INT,
  IN p_branchId INT,
  IN p_driverId INT,
  IN p_pageNumber INT,
  IN p_pageSize INT,
  IN p_loggedInUserId INT
)
BEGIN
  DECLARE v_roleName VARCHAR(100);
  DECLARE v_userCompanyId INT;
  DECLARE v_userBranchId INT;
  DECLARE v_selectedDriverId INT;
  DECLARE v_offset INT DEFAULT 0;

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

  IF p_pageNumber IS NULL OR p_pageNumber < 1 THEN
    SET p_pageNumber = 1;
  END IF;
  IF p_pageSize IS NULL OR p_pageSize < 1 OR p_pageSize > 100 THEN
    SET p_pageSize = 12;
  END IF;
  SET v_offset = (p_pageNumber - 1) * p_pageSize;

  SET v_selectedDriverId = p_driverId;
  IF v_selectedDriverId IS NULL THEN
    SELECT dp.driver_id
      INTO v_selectedDriverId
    FROM portal_driver_profiles dp
    WHERE (p_companyId IS NULL OR dp.company_id = p_companyId)
      AND (p_branchId IS NULL OR dp.branch_id = p_branchId)
    ORDER BY dp.driver_id
    LIMIT 1;
  END IF;

  SELECT
    dp.driver_id,
    dp.driver_name,
    dp.email,
    dp.avatar_url,
    dp.total_driving_hours,
    dp.total_mileage,
    dp.efficiency_score,
    dp.safety_score,
    dp.completion_rate
  FROM portal_driver_profiles dp
  WHERE dp.driver_id = v_selectedDriverId
  LIMIT 1;

  SELECT
    DATE_FORMAT(pm.period_month, '%b') AS monthLabel,
    pm.mileage,
    pm.driving_hours,
    pm.efficiency_score,
    pm.safety_score,
    pm.completion_rate
  FROM portal_driver_performance_monthly pm
  WHERE pm.driver_id = v_selectedDriverId
  ORDER BY pm.period_month;

  SELECT
    pm.period_month,
    pm.mileage,
    pm.driving_hours,
    pm.efficiency_score,
    pm.safety_score,
    pm.completion_rate,
    COUNT(1) OVER() AS totalRecords
  FROM portal_driver_performance_monthly pm
  WHERE pm.driver_id = v_selectedDriverId
  ORDER BY pm.period_month DESC
  LIMIT p_pageSize OFFSET v_offset;

  SELECT driver_id AS id, driver_name AS name
  FROM portal_driver_profiles
  WHERE (p_companyId IS NULL OR company_id = p_companyId)
    AND (p_branchId IS NULL OR branch_id = p_branchId)
  ORDER BY driver_name;
END
`;

const run = async () => {
  try {
    for (const sql of tableSql) {
      await db.query(sql);
    }
    try {
      await db.execute(
        "ALTER TABLE portal_driver_profiles ADD COLUMN driver_status VARCHAR(40) NOT NULL DEFAULT 'Active' AFTER completion_rate"
      );
    } catch (e) {
      if (e.code !== "ER_DUP_FIELDNAME") throw e;
    }

    const [profileCountRows] = await db.query("SELECT COUNT(1) AS total FROM portal_driver_profiles");
    const profileCount = profileCountRows[0]?.total || 0;
    if (!profileCount) {
      const [branches] = await db.query("SELECT branch_id, company_id, branch_name FROM branches WHERE isDeleted = 0 ORDER BY branch_id LIMIT 12");
      let counter = 1;
      for (const branch of branches) {
        for (let i = 0; i < 2; i += 1) {
          await db.execute(
            `INSERT INTO portal_driver_profiles
            (company_id, branch_id, driver_name, email, total_driving_hours, total_mileage, efficiency_score, safety_score, completion_rate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              branch.company_id,
              branch.branch_id,
              `Driver ${counter}`,
              `driver${counter}@fleet.ai`,
              120 + counter * 3,
              8000 + counter * 200,
              70 + (counter % 20),
              72 + (counter % 20),
              75 + (counter % 20),
            ]
          );
          counter += 1;
        }
      }
    }

    const [sCountRows] = await db.query("SELECT COUNT(1) AS total FROM portal_driver_schedule");
    const sCount = sCountRows[0]?.total || 0;
    if (!sCount) {
      const [drivers] = await db.query("SELECT driver_id, branch_id FROM portal_driver_profiles ORDER BY driver_id LIMIT 30");
      const weekdayRoutes = ["Route A", "Route B", "Route C", "Route D", "Route E", "Route F"];
      const fleets = ["AMXL X-Large", "CDV", "Step-Van", "Rental", "Prime Van", "City Bus"];
      const statuses = ["Route", "Rescue", "Standby", "Unavailable"];
      const mondaySql = "SELECT DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AS monday";
      const [mondayRows] = await db.query(mondaySql);
      const monday = new Date(mondayRows[0].monday);
      for (const driver of drivers) {
        for (let day = 0; day < 7; day += 1) {
          const d = new Date(monday);
          d.setDate(monday.getDate() + day);
          const dateText = d.toISOString().slice(0, 10);
          await db.execute(
            `INSERT INTO portal_driver_schedule
            (driver_id, schedule_date, route_name, fleet_assigned, station, start_time, end_time, status, work_block_rostered, schedule_association, voluntary_extra_time, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              driver.driver_id,
              dateText,
              weekdayRoutes[day % weekdayRoutes.length],
              fleets[(driver.driver_id + day) % fleets.length],
              `ST-${driver.branch_id}`,
              "09:30:00",
              "18:00:00",
              statuses[(driver.driver_id + day) % statuses.length],
              34 + ((driver.driver_id + day) % 5),
              (driver.driver_id + day) % 2,
              (driver.driver_id + day) % 3,
              "Standard Parcel",
            ]
          );
        }
      }
    }

    const [pCountRows] = await db.query("SELECT COUNT(1) AS total FROM portal_driver_performance_monthly");
    const pCount = pCountRows[0]?.total || 0;
    if (!pCount) {
      const [drivers] = await db.query("SELECT driver_id FROM portal_driver_profiles ORDER BY driver_id LIMIT 30");
      for (const driver of drivers) {
        for (let month = 1; month <= 12; month += 1) {
          const period = `2026-${String(month).padStart(2, "0")}-01`;
          await db.execute(
            `INSERT INTO portal_driver_performance_monthly
            (driver_id, period_month, mileage, driving_hours, efficiency_score, safety_score, completion_rate)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              driver.driver_id,
              period,
              6000 + month * 240 + (driver.driver_id % 10) * 120,
              90 + month * 4 + (driver.driver_id % 5),
              68 + month * 2 + (driver.driver_id % 8),
              70 + month * 2 + (driver.driver_id % 7),
              72 + month * 1.5 + (driver.driver_id % 6),
            ]
          );
        }
      }
    }

    for (const dropSql of dropSpsSql) {
      await db.query(dropSql);
    }
    await db.query(spDriverMainPageSql);
    await db.query(spScheduleSql);
    await db.query(spPerformanceSql);

    console.log("Driver schedule/performance tables and procedures are ready.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to setup driver module DB objects:", error.message);
    process.exit(1);
  }
};

run();
