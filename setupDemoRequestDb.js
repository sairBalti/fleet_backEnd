import dotenv from "dotenv";
import db from "./config/db.js";

dotenv.config();

const createTableSql = `
CREATE TABLE IF NOT EXISTS demo_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  company_name VARCHAR(160) NOT NULL,
  business_type VARCHAR(120) NOT NULL,
  fleet_size VARCHAR(80) NULL,
  preferred_date DATE NULL,
  goals TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_demo_created_at (created_at),
  INDEX idx_demo_business_type (business_type),
  INDEX idx_demo_company_name (company_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`;

const dropProcedureSql = "DROP PROCEDURE IF EXISTS portal_spDemoRequestMainPageData";

const createProcedureSql = `
CREATE PROCEDURE portal_spDemoRequestMainPageData(
  IN p_pageNumber INT,
  IN p_pageSize INT,
  IN p_sortColumn VARCHAR(64),
  IN p_sortDirection VARCHAR(4),
  IN p_nameFilter VARCHAR(120),
  IN p_emailFilter VARCHAR(190),
  IN p_businessTypeFilter VARCHAR(120),
  IN p_startDate DATE,
  IN p_endDate DATE
)
BEGIN
  DECLARE v_offset INT DEFAULT 0;
  DECLARE v_sortColumn VARCHAR(64) DEFAULT 'created_at';
  DECLARE v_sortDirection VARCHAR(4) DEFAULT 'DESC';

  IF p_pageNumber IS NULL OR p_pageNumber < 1 THEN
    SET p_pageNumber = 1;
  END IF;

  IF p_pageSize IS NULL OR p_pageSize < 1 THEN
    SET p_pageSize = 20;
  END IF;

  SET v_offset = (p_pageNumber - 1) * p_pageSize;

  IF p_sortColumn IN ('id','full_name','email','company_name','business_type','fleet_size','preferred_date','created_at') THEN
    SET v_sortColumn = p_sortColumn;
  END IF;

  IF UPPER(p_sortDirection) = 'ASC' THEN
    SET v_sortDirection = 'ASC';
  ELSE
    SET v_sortDirection = 'DESC';
  END IF;

  SET @sql_data = CONCAT(
    'SELECT id, full_name, email, company_name, business_type, fleet_size, preferred_date, goals, created_at ',
    'FROM demo_requests WHERE 1=1 ',
    'AND (? IS NULL OR ? = "" OR full_name COLLATE utf8mb4_0900_ai_ci LIKE CONCAT("%", ?, "%")) ',
    'AND (? IS NULL OR ? = "" OR email COLLATE utf8mb4_0900_ai_ci LIKE CONCAT("%", ?, "%")) ',
    'AND (? IS NULL OR ? = "" OR business_type COLLATE utf8mb4_0900_ai_ci = ?) ',
    'AND (? IS NULL OR DATE(created_at) >= ?) ',
    'AND (? IS NULL OR DATE(created_at) <= ?) ',
    'ORDER BY ', v_sortColumn, ' ', v_sortDirection, ' ',
    'LIMIT ?, ?'
  );

  SET @nameFilter = p_nameFilter;
  SET @emailFilter = p_emailFilter;
  SET @businessTypeFilter = p_businessTypeFilter;
  SET @startDate = p_startDate;
  SET @endDate = p_endDate;
  SET @offset = v_offset;
  SET @limitSize = p_pageSize;

  PREPARE stmt_data FROM @sql_data;
  EXECUTE stmt_data USING
    @nameFilter, @nameFilter, @nameFilter,
    @emailFilter, @emailFilter, @emailFilter,
    @businessTypeFilter, @businessTypeFilter, @businessTypeFilter,
    @startDate, @startDate,
    @endDate, @endDate,
    @offset, @limitSize;
  DEALLOCATE PREPARE stmt_data;

  SELECT COUNT(1) AS totalRecords
  FROM demo_requests
  WHERE 1=1
    AND (p_nameFilter IS NULL OR p_nameFilter = '' OR full_name COLLATE utf8mb4_0900_ai_ci LIKE CONCAT('%', p_nameFilter, '%'))
    AND (p_emailFilter IS NULL OR p_emailFilter = '' OR email COLLATE utf8mb4_0900_ai_ci LIKE CONCAT('%', p_emailFilter, '%'))
    AND (p_businessTypeFilter IS NULL OR p_businessTypeFilter = '' OR business_type COLLATE utf8mb4_0900_ai_ci = p_businessTypeFilter)
    AND (p_startDate IS NULL OR DATE(created_at) >= p_startDate)
    AND (p_endDate IS NULL OR DATE(created_at) <= p_endDate);
END
`;

const run = async () => {
  try {
    await db.execute(createTableSql);
    await db.query(dropProcedureSql);
    await db.query(createProcedureSql);
    console.log("Demo request table and stored procedure are ready.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to setup demo request DB objects:", error.message);
    process.exit(1);
  }
};

run();
