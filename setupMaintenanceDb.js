import dotenv from "dotenv";
import db from "./config/db.js";

dotenv.config();

const run = async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS portal_maintenance_work_orders (
        work_order_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id INT NOT NULL,
        branch_id INT NOT NULL,
        vehicle_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT NULL,
        priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
        status VARCHAR(30) NOT NULL DEFAULT 'Open',
        due_date DATE NULL,
        completed_at DATETIME NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (work_order_id),
        INDEX idx_maint_co_br (company_id, branch_id),
        INDEX idx_maint_vehicle (vehicle_id),
        INDEX idx_maint_status (status),
        CONSTRAINT fk_maint_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const [cnt] = await db.execute(
      "SELECT COUNT(1) AS c FROM portal_maintenance_work_orders"
    );
    if ((cnt[0]?.c || 0) === 0) {
      const [vehicles] = await db.execute(
        `SELECT v.id AS vehicle_id, v.company_id, v.branch_id
         FROM vehicles v
         WHERE v.company_id IS NOT NULL AND v.branch_id IS NOT NULL
         ORDER BY v.id
         LIMIT 8`
      );
      for (let i = 0; i < vehicles.length; i += 1) {
        const v = vehicles[i];
        const due = new Date();
        due.setDate(due.getDate() + 7 + i * 3);
        const dueStr = due.toISOString().slice(0, 10);
        await db.execute(
          `INSERT INTO portal_maintenance_work_orders
          (company_id, branch_id, vehicle_id, title, description, priority, status, due_date)
          VALUES (?,?,?,?,?,?,?,?)`,
          [
            v.company_id,
            v.branch_id,
            v.vehicle_id,
            i % 2 === 0 ? "Brake inspection" : "Oil change & filter",
            "Scheduled preventive service.",
            i % 3 === 0 ? "High" : "Medium",
            i % 4 === 0 ? "Open" : "In Progress",
            dueStr,
          ]
        );
      }
      console.log("Seeded sample maintenance work orders.");
    }

    console.log("Maintenance work orders table is ready.");
    process.exit(0);
  } catch (e) {
    console.error("setupMaintenanceDb failed:", e.message);
    process.exit(1);
  }
};

run();
