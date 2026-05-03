import dotenv from "dotenv";
import db from "./config/db.js";

dotenv.config();

const dropProceduresSql = [
  "DROP PROCEDURE IF EXISTS portal_spVehicleMainPageData",
  "DROP PROCEDURE IF EXISTS portal_spVehicleInsert",
  "DROP PROCEDURE IF EXISTS portal_spVehicleUpdate",
  "DROP PROCEDURE IF EXISTS portal_spVehicleGetById",
  "DROP PROCEDURE IF EXISTS portal_spVehicleDelete",
  "DROP PROCEDURE IF EXISTS portal_spVehicleDeleteMultiple",
];

const createMainPageProcedureSql = `
CREATE PROCEDURE portal_spVehicleMainPageData(
  IN p_companyId INT,
  IN p_branchId INT,
  IN p_statusFilter VARCHAR(50),
  IN p_startDate DATE,
  IN p_endDate DATE,
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
  DECLARE v_sortColumn VARCHAR(64) DEFAULT 'registration';
  DECLARE v_sortDirection VARCHAR(4) DEFAULT 'ASC';
  DECLARE v_offset INT DEFAULT 0;

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

  IF p_sortColumn IN ('registration', 'manufacturer', 'date_registered') THEN
    SET v_sortColumn = p_sortColumn;
  END IF;

  IF UPPER(IFNULL(p_sortDirection, 'ASC')) = 'DESC' THEN
    SET v_sortDirection = 'DESC';
  ELSE
    SET v_sortDirection = 'ASC';
  END IF;

  IF v_roleName NOT IN ('SuperAdmin', 'Admin') THEN
    SET p_companyId = v_userCompanyId;
    IF v_roleName IN ('BranchManager', 'Driver') THEN
      SET p_branchId = v_userBranchId;
    END IF;
  END IF;

  SET @sql_data = CONCAT(
    'SELECT ',
    'v.id, v.company_id, v.branch_id, v.registration, v.manufacturer, v.model, v.date_registered, ',
    'v.maintenance_interval_months, v.fuel_type_id, ft.fuel_type_name AS fuel_type, ',
    'v.status_id, s.status_name AS status, ',
    'COUNT(1) OVER() AS totalRecords ',
    'FROM vehicles v ',
    'LEFT JOIN lookup_fueltypes ft ON ft.fuel_type_id = v.fuel_type_id ',
    'LEFT JOIN lookup_vehiclestatus s ON s.status_id = v.status_id ',
    'WHERE 1=1 ',
    'AND (? IS NULL OR v.company_id = ?) ',
    'AND (? IS NULL OR v.branch_id = ?) ',
    'AND (? IS NULL OR ? = "" OR s.status_name = ? OR CAST(v.status_id AS CHAR) = ?) ',
    'AND (? IS NULL OR DATE(v.date_registered) >= ?) ',
    'AND (? IS NULL OR DATE(v.date_registered) <= ?) ',
    'ORDER BY ', v_sortColumn, ' ', v_sortDirection, ' ',
    'LIMIT ?, ?'
  );

  SET @companyId = p_companyId;
  SET @branchId = p_branchId;
  SET @statusFilter = p_statusFilter;
  SET @startDate = p_startDate;
  SET @endDate = p_endDate;
  SET @offset = v_offset;
  SET @limitSize = p_pageSize;

  PREPARE stmt_data FROM @sql_data;
  EXECUTE stmt_data USING
    @companyId, @companyId,
    @branchId, @branchId,
    @statusFilter, @statusFilter, @statusFilter, @statusFilter,
    @startDate, @startDate,
    @endDate, @endDate,
    @offset, @limitSize;
  DEALLOCATE PREPARE stmt_data;

  SELECT status_id AS id, status_name AS name
  FROM lookup_vehiclestatus
  ORDER BY status_id;
END
`;

const createInsertProcedureSql = `
CREATE PROCEDURE portal_spVehicleInsert(
  IN p_company_id INT,
  IN p_branch_id INT,
  IN p_registration VARCHAR(100),
  IN p_manufacturer VARCHAR(120),
  IN p_model VARCHAR(120),
  IN p_date_registered DATETIME,
  IN p_maintenance_interval_months INT,
  IN p_fuel_type_id INT,
  IN p_status_id INT
)
BEGIN
  INSERT INTO vehicles (
    company_id, branch_id, registration, manufacturer, model,
    date_registered, maintenance_interval_months, fuel_type_id, status_id
  ) VALUES (
    p_company_id, p_branch_id, p_registration, p_manufacturer, p_model,
    p_date_registered, p_maintenance_interval_months, p_fuel_type_id, p_status_id
  );

  SELECT LAST_INSERT_ID() AS vehicle_id;
END
`;

const createUpdateProcedureSql = `
CREATE PROCEDURE portal_spVehicleUpdate(
  IN p_vehicle_id INT,
  IN p_company_id INT,
  IN p_branch_id INT,
  IN p_registration VARCHAR(100),
  IN p_manufacturer VARCHAR(120),
  IN p_model VARCHAR(120),
  IN p_date_registered DATETIME,
  IN p_maintenance_interval_months INT,
  IN p_fuel_type_id INT,
  IN p_status_id INT
)
BEGIN
  UPDATE vehicles
  SET
    company_id = p_company_id,
    branch_id = p_branch_id,
    registration = p_registration,
    manufacturer = p_manufacturer,
    model = p_model,
    date_registered = p_date_registered,
    maintenance_interval_months = p_maintenance_interval_months,
    fuel_type_id = p_fuel_type_id,
    status_id = p_status_id
  WHERE id = p_vehicle_id;
END
`;

const createGetByIdProcedureSql = `
CREATE PROCEDURE portal_spVehicleGetById(IN p_vehicle_id INT)
BEGIN
  SELECT
    v.id, v.company_id, v.branch_id, v.registration, v.manufacturer, v.model,
    v.date_registered, v.maintenance_interval_months,
    v.fuel_type_id, ft.fuel_type_name AS fuel_type,
    v.status_id, s.status_name AS status
  FROM vehicles v
  LEFT JOIN lookup_fueltypes ft ON ft.fuel_type_id = v.fuel_type_id
  LEFT JOIN lookup_vehiclestatus s ON s.status_id = v.status_id
  WHERE v.id = p_vehicle_id
  LIMIT 1;
END
`;

const createDeleteProcedureSql = `
CREATE PROCEDURE portal_spVehicleDelete(IN p_vehicle_id INT)
BEGIN
  DELETE FROM vehicles WHERE id = p_vehicle_id;
END
`;

const createDeleteMultipleProcedureSql = `
CREATE PROCEDURE portal_spVehicleDeleteMultiple(IN p_ids TEXT)
BEGIN
  SET @sql = CONCAT('DELETE FROM vehicles WHERE id IN (', p_ids, ')');
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
END
`;

const run = async () => {
  try {
    for (const dropSql of dropProceduresSql) {
      await db.query(dropSql);
    }

    await db.query(createMainPageProcedureSql);
    await db.query(createInsertProcedureSql);
    await db.query(createUpdateProcedureSql);
    await db.query(createGetByIdProcedureSql);
    await db.query(createDeleteProcedureSql);
    await db.query(createDeleteMultipleProcedureSql);
    console.log("Vehicle stored procedures are ready.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to setup vehicle DB objects:", error.message);
    process.exit(1);
  }
};

run();
