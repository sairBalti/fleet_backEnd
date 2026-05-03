import dotenv from "dotenv";
import db from "./config/db.js";

dotenv.config();

const pad = (n) => String(n).padStart(2, "0");
const toDateText = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const ensureVehicles = async (companyId, branchId, regPrefix = "WAK") => {
  const [countRows] = await db.execute(
    "SELECT COUNT(1) AS total FROM vehicles WHERE company_id = ? AND branch_id = ?",
    [companyId, branchId]
  );
  const existing = countRows[0]?.total || 0;
  const needed = Math.max(0, 8 - existing);

  for (let i = 0; i < needed; i += 1) {
    const reg = `${regPrefix}-${branchId}-${100 + i}`;
    await db.execute(
      `INSERT INTO vehicles
      (company_id, branch_id, registration, manufacturer, model, date_registered, maintenance_interval_months, fuel_type_id, status_id)
      SELECT ?, ?, ?, ?, ?, NOW(), ?, ?, ?
      FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1 FROM vehicles WHERE company_id = ? AND branch_id = ? AND registration = ?
      )`,
      [companyId, branchId, reg, "Tata", "Ace", 6, ((i % 3) + 1), ((i % 4) + 1), companyId, branchId, reg]
    );
  }
};

const ensureDriverPerformance = async (driverId) => {
  for (let month = 1; month <= 12; month += 1) {
    const period = `2026-${pad(month)}-01`;
    await db.execute(
      `INSERT INTO portal_driver_performance_monthly
      (driver_id, period_month, mileage, driving_hours, efficiency_score, safety_score, completion_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        mileage = VALUES(mileage),
        driving_hours = VALUES(driving_hours),
        efficiency_score = VALUES(efficiency_score),
        safety_score = VALUES(safety_score),
        completion_rate = VALUES(completion_rate)`,
      [
        driverId,
        period,
        6800 + month * 280 + (driverId % 9) * 110,
        95 + month * 3 + (driverId % 5),
        72 + month * 1.8 + (driverId % 7),
        75 + month * 1.7 + (driverId % 6),
        78 + month * 1.5 + (driverId % 5),
      ]
    );
  }
};

const ensureWeeklySchedules = async (driverId, branchId, stationPrefix = "WAK") => {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const routes = ["Route A", "Route B", "Route C", "Route D", "Route E", "Route F"];
  const fleets = ["AMXL X-Large", "CDV", "Step-van", "Rental", "EV", "Prime Van"];
  const statuses = ["Route", "Rescue", "Standby", "Unavailable", "Route", "In-progress"];
  const startTimes = ["09:15:00", "09:57:00", "10:15:00"];
  const endTimes = ["18:00:00", "17:50:00", "18:11:00"];

  for (let day = 0; day < 7; day += 1) {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + day);
    const scheduleDate = toDateText(dt);
    await db.execute(
      `INSERT INTO portal_driver_schedule
      (driver_id, schedule_date, route_name, fleet_assigned, station, start_time, end_time, status, work_block_rostered, schedule_association, voluntary_extra_time, notes)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1 FROM portal_driver_schedule WHERE driver_id = ? AND schedule_date = ?
      )`,
      [
        driverId,
        scheduleDate,
        routes[(driverId + day) % routes.length],
        fleets[(driverId + day) % fleets.length],
        `${stationPrefix}-${branchId}`,
        startTimes[day % startTimes.length],
        endTimes[day % endTimes.length],
        statuses[(driverId + day) % statuses.length],
        34 + (day % 4),
        day % 2,
        day % 3,
        "Standard Parcel",
        driverId,
        scheduleDate,
      ]
    );
  }
};

const ensureNotifications = async (companyId) => {
  const rows = [
    ["Fleet health improved this week", "Driver compliance trend is up by 9%", "success"],
    ["Route risk detected", "3 routes flagged for congestion impact", "warning"],
    ["Maintenance advisory", "2 vehicles due for preventive maintenance", "info"],
    ["Driver schedule update", "New weekly assignments published", "info"],
  ];
  for (const [title, message, type] of rows) {
    await db.execute(
      `INSERT INTO portal_notifications (company_id, branch_id, title, message, type)
       SELECT ?, NULL, ?, ?, ?
       FROM DUAL
       WHERE NOT EXISTS (
         SELECT 1 FROM portal_notifications WHERE company_id = ? AND title = ? AND message = ?
       )`,
      [companyId, title, message, type, companyId, title, message]
    );
  }
};

const seedCompany = async (companyName, { regPrefix = "WAK", stationPrefix = "WAK" } = {}) => {
  const [companyRows] = await db.execute(
    "SELECT company_id FROM companies WHERE company_name = ? LIMIT 1",
    [companyName]
  );
  if (!companyRows.length) {
    console.warn(`Skip seed: company "${companyName}" not found.`);
    return null;
  }
  const companyId = companyRows[0].company_id;

  let [branches] = await db.execute(
    "SELECT branch_id FROM branches WHERE company_id = ? AND isDeleted = 0 ORDER BY branch_id",
    [companyId]
  );

  if (!branches.length) {
    await db.execute(
      `INSERT INTO branches (company_id, branch_name, branch_location, isDeleted)
       VALUES (?, ?, ?, 0)`,
      [companyId, `${companyName} Main`, "HQ"]
    );
    [branches] = await db.execute(
      "SELECT branch_id FROM branches WHERE company_id = ? AND isDeleted = 0 ORDER BY branch_id",
      [companyId]
    );
    console.log(`Created default branch for ${companyName}.`);
  }

  let [drivers] = await db.execute(
    "SELECT driver_id, branch_id FROM portal_driver_profiles WHERE company_id = ? ORDER BY driver_id LIMIT 30",
    [companyId]
  );

  if (!drivers.length) {
    const names = ["Alex Rivera", "Jordan Lee", "Sam Patel", "Taylor Chen", "Morgan Blake", "Casey Wu"];
    let idx = 0;
    for (const b of branches) {
      for (let i = 0; i < 2; i += 1) {
        const name = `${names[idx % names.length]} ${idx + 1}`;
        const email = `kpi.${companyId}.${b.branch_id}.${idx}@fleet.ai`;
        await db.execute(
          `INSERT INTO portal_driver_profiles
          (company_id, branch_id, driver_name, email, total_driving_hours, total_mileage, efficiency_score, safety_score, completion_rate)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            b.branch_id,
            name,
            email,
            130 + idx * 4,
            8500 + idx * 200,
            76 + (idx % 12),
            78 + (idx % 11),
            80 + (idx % 10),
          ]
        );
        idx += 1;
      }
    }
    [drivers] = await db.execute(
      "SELECT driver_id, branch_id FROM portal_driver_profiles WHERE company_id = ? ORDER BY driver_id LIMIT 30",
      [companyId]
    );
    console.log(`Created drivers for ${companyName}.`);
  }

  for (const b of branches) {
    await ensureVehicles(companyId, b.branch_id, regPrefix);
  }

  for (const d of drivers) {
    await ensureDriverPerformance(d.driver_id);
    await ensureWeeklySchedules(d.driver_id, d.branch_id, stationPrefix);
  }

  await ensureNotifications(companyId);

  const [summaryRows] = await db.execute(
    `SELECT
      (SELECT COUNT(1) FROM portal_driver_profiles WHERE company_id = ?) AS driverCount,
      (SELECT COUNT(1) FROM vehicles WHERE company_id = ?) AS vehicleCount,
      (SELECT COUNT(1) FROM portal_driver_performance_monthly pm INNER JOIN portal_driver_profiles dp ON dp.driver_id = pm.driver_id WHERE dp.company_id = ?) AS perfCount,
      (SELECT COUNT(1) FROM portal_driver_schedule ds INNER JOIN portal_driver_profiles dp ON dp.driver_id = ds.driver_id WHERE dp.company_id = ?) AS scheduleCount`,
    [companyId, companyId, companyId, companyId]
  );

  console.log(`Dashboard KPI seed complete for ${companyName}:`, summaryRows[0]);
  return summaryRows[0];
};

const run = async () => {
  await seedCompany("WAK Builders", { regPrefix: "WAK", stationPrefix: "WAK" });
  await seedCompany("Wak2", { regPrefix: "WK2", stationPrefix: "WK2" });
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to seed dashboard KPI data:", error.message);
    process.exit(1);
  });
