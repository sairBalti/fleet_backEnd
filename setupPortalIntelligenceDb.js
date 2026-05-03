import dotenv from "dotenv";
import db from "./config/db.js";

dotenv.config();

const createTablesSql = [
  `CREATE TABLE IF NOT EXISTS portal_modules (
    module_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(100) NOT NULL UNIQUE,
    icon_key VARCHAR(50) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (module_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS portal_submodules (
    submodule_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    module_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    path VARCHAR(255) NOT NULL UNIQUE,
    sort_order INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (submodule_id),
    CONSTRAINT fk_portal_submodule_module FOREIGN KEY (module_id) REFERENCES portal_modules(module_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS portal_role_submodule_permissions (
    permission_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    role_id INT NOT NULL,
    submodule_id INT UNSIGNED NOT NULL,
    can_view TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (permission_id),
    UNIQUE KEY uq_portal_role_submodule (role_id, submodule_id),
    CONSTRAINT fk_portal_permission_submodule FOREIGN KEY (submodule_id) REFERENCES portal_submodules(submodule_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

const moduleSeed = [
  {
    title: "Dashboard",
    icon_key: "dashboard",
    sort_order: 1,
    submodules: [
      { name: "KPIs", path: "/dashboard/kpis", sort_order: 1 },
      { name: "Real Time Statistics", path: "/dashboard/realtime", sort_order: 2 },
    ],
  },
  {
    title: "Businesses",
    icon_key: "businesses",
    sort_order: 2,
    submodules: [
      { name: "OnBoards", path: "/businesses/live", sort_order: 1 },
      { name: "Targets", path: "/businesses/targets", sort_order: 2 },
      { name: "Branches", path: "/branches", sort_order: 3 },
    ],
  },
  {
    title: "Fleet",
    icon_key: "fleet",
    sort_order: 3,
    submodules: [
      { name: "Vehicle List", path: "/fleet/vehicles", sort_order: 1 },
      { name: "Fleet Overview", path: "/fleet/overview", sort_order: 2 },
      { name: "Fleet Inspection", path: "/fleet/inspection", sort_order: 3 },
      { name: "Fleet Assignment", path: "/fleet/assignment", sort_order: 4 },
    ],
  },
  {
    title: "Reports",
    icon_key: "reports",
    sort_order: 4,
    submodules: [
      { name: "Monthly Reports", path: "/reports/monthly", sort_order: 1 },
      { name: "Annual Reports", path: "/reports/annual", sort_order: 2 },
    ],
  },
  {
    title: "Driver",
    icon_key: "driver",
    sort_order: 5,
    submodules: [
      { name: "Driver Overview", path: "/driver/overview", sort_order: 1 },
      { name: "Driver Schedule", path: "/driver/schedule", sort_order: 2 },
      { name: "Driver Performance", path: "/driver/performance", sort_order: 3 },
    ],
  },
  {
    title: "Maintenance",
    icon_key: "maintenance",
    sort_order: 6,
    submodules: [{ name: "Maintenance", path: "/maintenance", sort_order: 1 }],
  },
  {
    title: "Trips",
    icon_key: "trips",
    sort_order: 7,
    submodules: [{ name: "Trips", path: "/trips", sort_order: 1 }],
  },
  {
    title: "Chat",
    icon_key: "chat",
    sort_order: 8,
    submodules: [{ name: "Chat", path: "/chat", sort_order: 1 }],
  },
  {
    title: "Settings",
    icon_key: "settings",
    sort_order: 9,
    submodules: [
      { name: "Account Settings", path: "/settings/account", sort_order: 1 },
      { name: "User Management", path: "/settings/users", sort_order: 2 },
      { name: "System Preferences", path: "/settings/preferences", sort_order: 3 },
    ],
  },
  {
    title: "Help Desk",
    icon_key: "help",
    sort_order: 10,
    submodules: [{ name: "Help Desk", path: "/helpdesk", sort_order: 1 }],
  },
];

const roleRules = {
  SuperAdmin: [/.*/],
  Admin: [/^\/dashboard\//, /^\/businesses\/(live|targets)$/, /^\/fleet\//, /^\/reports\//, /^\/driver\//, /^\/maintenance$/, /^\/trips$/, /^\/chat$/, /^\/settings\//, /^\/helpdesk$/],
  CompanyAdmin: [/^\/dashboard\//, /^\/businesses\/(live|targets)$/, /^\/fleet\//, /^\/reports\//, /^\/driver\//, /^\/maintenance$/, /^\/trips$/, /^\/chat$/, /^\/settings\//, /^\/helpdesk$/],
  CompanyManager: [/^\/dashboard\//, /^\/businesses\/(live|targets)$/, /^\/fleet\//, /^\/reports\//, /^\/driver\//, /^\/maintenance$/, /^\/trips$/, /^\/chat$/, /^\/settings\//, /^\/helpdesk$/],
  BranchManager: [/^\/dashboard\//, /^\/branches$/, /^\/fleet\//, /^\/reports\//, /^\/driver\//, /^\/maintenance$/, /^\/trips$/, /^\/chat$/, /^\/settings\/account$/, /^\/helpdesk$/],
  Manager: [/^\/dashboard\//, /^\/fleet\//, /^\/reports\//, /^\/driver\//, /^\/maintenance$/, /^\/trips$/, /^\/chat$/, /^\/helpdesk$/],
  Maintenance: [/^\/dashboard\//, /^\/fleet\/inspection$/, /^\/maintenance$/, /^\/helpdesk$/],
  Driver: [/^\/dashboard\//, /^\/driver\//, /^\/fleet\/inspection$/, /^\/trips$/, /^\/chat$/, /^\/helpdesk$/],
  Viewer: [/^\/dashboard\//, /^\/reports\//, /^\/helpdesk$/],
};

const dropProcedureSql = "DROP PROCEDURE IF EXISTS portal_spGetRoleNavigation";

const createProcedureSql = `
CREATE PROCEDURE portal_spGetRoleNavigation(IN p_role_name VARCHAR(100))
BEGIN
  SELECT
    pm.title AS module_title,
    pm.icon_key,
    psm.name AS submodule_name,
    psm.path,
    pm.sort_order AS module_sort,
    psm.sort_order AS submodule_sort
  FROM portal_modules pm
  INNER JOIN portal_submodules psm ON psm.module_id = pm.module_id AND psm.is_active = 1
  INNER JOIN portal_role_submodule_permissions prsp ON prsp.submodule_id = psm.submodule_id AND prsp.can_view = 1
  INNER JOIN lookup_roles lr ON lr.role_id = prsp.role_id
  WHERE pm.is_active = 1
    AND lr.role_name = p_role_name
  ORDER BY pm.sort_order, psm.sort_order;
END
`;

const run = async () => {
  try {
    for (const statement of createTablesSql) {
      await db.query(statement);
    }

    for (const module of moduleSeed) {
      await db.execute(
        `INSERT INTO portal_modules (title, icon_key, sort_order, is_active)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE icon_key = VALUES(icon_key), sort_order = VALUES(sort_order), is_active = 1`,
        [module.title, module.icon_key, module.sort_order]
      );

      const [moduleRows] = await db.execute("SELECT module_id FROM portal_modules WHERE title = ?", [module.title]);
      const moduleId = moduleRows[0]?.module_id;

      for (const submodule of module.submodules) {
        await db.execute(
          `INSERT INTO portal_submodules (module_id, name, path, sort_order, is_active)
           VALUES (?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE module_id = VALUES(module_id), name = VALUES(name), sort_order = VALUES(sort_order), is_active = 1`,
          [moduleId, submodule.name, submodule.path, submodule.sort_order]
        );
      }
    }

    // Deactivate legacy/manual submodules that are no longer part of sidebar seed.
    const seededPaths = moduleSeed.flatMap((module) => module.submodules.map((submodule) => submodule.path));
    if (seededPaths.length > 0) {
      const placeholders = seededPaths.map(() => "?").join(",");
      await db.execute(
        `UPDATE portal_submodules SET is_active = 0 WHERE path NOT IN (${placeholders})`,
        seededPaths
      );
    }

    const [roles] = await db.execute("SELECT role_id, role_name FROM lookup_roles");
    const [submodules] = await db.execute("SELECT submodule_id, path FROM portal_submodules WHERE is_active = 1");

    for (const role of roles) {
      const rules = roleRules[role.role_name] || [];
      for (const submodule of submodules) {
        const isBranchesPath = submodule.path === "/branches";
        const isTargetsPath = submodule.path === "/businesses/targets";
        const allowed =
          isTargetsPath && role.role_name !== "SuperAdmin"
            ? 0
            : isBranchesPath && role.role_name !== "BranchManager"
            ? 0
            : rules.some((regex) => regex.test(submodule.path))
              ? 1
              : 0;
        await db.execute(
          `INSERT INTO portal_role_submodule_permissions (role_id, submodule_id, can_view)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE can_view = VALUES(can_view)`,
          [role.role_id, submodule.submodule_id, allowed]
        );
      }
    }

    await db.query(dropProcedureSql);
    await db.query(createProcedureSql);

    console.log("Portal intelligence tables, permissions, and SP are ready.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to setup portal intelligence DB objects:", error.message);
    process.exit(1);
  }
};

run();
