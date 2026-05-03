import dotenv from "dotenv";
import db from "./config/db.js";

dotenv.config();

const dropMonthly = "DROP PROCEDURE IF EXISTS portal_spReportsMonthly";
const dropAnnual = "DROP PROCEDURE IF EXISTS portal_spReportsAnnual";

const createMonthly = `
CREATE PROCEDURE portal_spReportsMonthly(
  IN p_year INT,
  IN p_month INT,
  IN p_businessType VARCHAR(120),
  IN p_companyIds TEXT,
  IN p_branchIds TEXT
)
BEGIN
  DECLARE v_start DATE;
  DECLARE v_end DATE;
  SET v_start = STR_TO_DATE(CONCAT(p_year, '-', LPAD(p_month, 2, '0'), '-01'), '%Y-%m-%d');
  SET v_end = LAST_DAY(v_start);

  SELECT
    (SELECT COUNT(1)
     FROM companies c
     LEFT JOIN lookup_businesstypes bt ON bt.business_type_id = c.business_type_id
     WHERE DATE(c.created_at) BETWEEN v_start AND v_end
       AND (p_businessType IS NULL OR p_businessType = '' OR bt.business_type_name COLLATE utf8mb4_unicode_ci = p_businessType COLLATE utf8mb4_unicode_ci)
       AND (p_companyIds IS NULL OR FIND_IN_SET(c.company_id, p_companyIds))
    ) AS totalCompanies,
    (SELECT COUNT(1)
     FROM branches b
     INNER JOIN companies c ON c.company_id = b.company_id
     LEFT JOIN lookup_businesstypes bt ON bt.business_type_id = c.business_type_id
     WHERE DATE(b.created_at) BETWEEN v_start AND v_end
       AND (p_businessType IS NULL OR p_businessType = '' OR bt.business_type_name COLLATE utf8mb4_unicode_ci = p_businessType COLLATE utf8mb4_unicode_ci)
       AND (p_companyIds IS NULL OR FIND_IN_SET(c.company_id, p_companyIds))
       AND (p_branchIds IS NULL OR FIND_IN_SET(b.branch_id, p_branchIds))
    ) AS totalBranches,
    (SELECT COUNT(1)
     FROM vehicles v
     INNER JOIN companies c ON c.company_id = v.company_id
     LEFT JOIN lookup_businesstypes bt ON bt.business_type_id = c.business_type_id
     WHERE DATE(v.created_at) BETWEEN v_start AND v_end
       AND (p_businessType IS NULL OR p_businessType = '' OR bt.business_type_name COLLATE utf8mb4_unicode_ci = p_businessType COLLATE utf8mb4_unicode_ci)
       AND (p_companyIds IS NULL OR FIND_IN_SET(c.company_id, p_companyIds))
       AND (p_branchIds IS NULL OR FIND_IN_SET(v.branch_id, p_branchIds))
    ) AS totalVehicles,
    (SELECT COUNT(1)
     FROM demo_requests dr
     WHERE DATE(dr.created_at) BETWEEN v_start AND v_end
       AND (p_businessType IS NULL OR p_businessType = '' OR dr.business_type COLLATE utf8mb4_unicode_ci = p_businessType COLLATE utf8mb4_unicode_ci)
    ) AS totalDemoRequests;

  SELECT
    bt.business_type_name,
    COUNT(c.company_id) AS companies,
    SUM(CASE WHEN c.is_active = 1 THEN 1 ELSE 0 END) AS activeCompanies
  FROM companies c
  LEFT JOIN lookup_businesstypes bt ON bt.business_type_id = c.business_type_id
  WHERE DATE(c.created_at) BETWEEN v_start AND v_end
    AND (p_businessType IS NULL OR p_businessType = '' OR bt.business_type_name COLLATE utf8mb4_unicode_ci = p_businessType COLLATE utf8mb4_unicode_ci)
    AND (p_companyIds IS NULL OR FIND_IN_SET(c.company_id, p_companyIds))
  GROUP BY bt.business_type_name
  ORDER BY companies DESC;
END
`;

const createAnnual = `
CREATE PROCEDURE portal_spReportsAnnual(
  IN p_year INT,
  IN p_businessType VARCHAR(120),
  IN p_companyIds TEXT,
  IN p_branchIds TEXT
)
BEGIN
  SELECT
    m.month_no AS monthNumber,
    DATE_FORMAT(STR_TO_DATE(CONCAT(p_year, '-', LPAD(m.month_no, 2, '0'), '-01'), '%Y-%m-%d'), '%b') AS monthName,
    (
      SELECT COUNT(1) FROM companies c
      LEFT JOIN lookup_businesstypes bt ON bt.business_type_id = c.business_type_id
      WHERE YEAR(c.created_at) = p_year AND MONTH(c.created_at) = m.month_no
        AND (p_businessType IS NULL OR p_businessType = '' OR bt.business_type_name COLLATE utf8mb4_unicode_ci = p_businessType COLLATE utf8mb4_unicode_ci)
        AND (p_companyIds IS NULL OR FIND_IN_SET(c.company_id, p_companyIds))
    ) AS companies,
    (
      SELECT COUNT(1) FROM branches b
      INNER JOIN companies c ON c.company_id = b.company_id
      LEFT JOIN lookup_businesstypes bt ON bt.business_type_id = c.business_type_id
      WHERE YEAR(b.created_at) = p_year AND MONTH(b.created_at) = m.month_no
        AND (p_businessType IS NULL OR p_businessType = '' OR bt.business_type_name COLLATE utf8mb4_unicode_ci = p_businessType COLLATE utf8mb4_unicode_ci)
        AND (p_companyIds IS NULL OR FIND_IN_SET(c.company_id, p_companyIds))
        AND (p_branchIds IS NULL OR FIND_IN_SET(b.branch_id, p_branchIds))
    ) AS branches,
    (
      SELECT COUNT(1) FROM vehicles v
      INNER JOIN companies c ON c.company_id = v.company_id
      LEFT JOIN lookup_businesstypes bt ON bt.business_type_id = c.business_type_id
      WHERE YEAR(v.created_at) = p_year AND MONTH(v.created_at) = m.month_no
        AND (p_businessType IS NULL OR p_businessType = '' OR bt.business_type_name COLLATE utf8mb4_unicode_ci = p_businessType COLLATE utf8mb4_unicode_ci)
        AND (p_companyIds IS NULL OR FIND_IN_SET(c.company_id, p_companyIds))
        AND (p_branchIds IS NULL OR FIND_IN_SET(v.branch_id, p_branchIds))
    ) AS vehicles,
    (
      SELECT COUNT(1) FROM demo_requests dr
      WHERE YEAR(dr.created_at) = p_year AND MONTH(dr.created_at) = m.month_no
        AND (p_businessType IS NULL OR p_businessType = '' OR dr.business_type COLLATE utf8mb4_unicode_ci = p_businessType COLLATE utf8mb4_unicode_ci)
    ) AS demoRequests
  FROM (
    SELECT 1 AS month_no UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL
    SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL
    SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12
  ) m
  ORDER BY m.month_no;
END
`;

const run = async () => {
  try {
    await db.query(dropMonthly);
    await db.query(dropAnnual);
    await db.query(createMonthly);
    await db.query(createAnnual);
    console.log("Reports stored procedures are ready.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to setup reports procedures:", error.message);
    process.exit(1);
  }
};

run();
