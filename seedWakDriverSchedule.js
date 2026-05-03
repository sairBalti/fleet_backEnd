import dotenv from "dotenv";
import db from "./config/db.js";

dotenv.config();

const pad = (n) => String(n).padStart(2, "0");
const toDateText = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const run = async () => {
  const [companyRows] = await db.execute(
    "SELECT company_id FROM companies WHERE company_name = ? LIMIT 1",
    ["WAK Builders"]
  );

  if (!companyRows.length) {
    console.log("WAK Builders company not found.");
    return;
  }

  const companyId = companyRows[0].company_id;
  const [branches] = await db.execute(
    "SELECT branch_id, branch_name FROM branches WHERE company_id = ? AND isDeleted = 0 ORDER BY branch_id",
    [companyId]
  );

  const names = [
    "Akashdeep Singh",
    "Alberto Jesus",
    "Alfonso Rebert",
    "Alfonso Rebert II",
    "Phoenix Baker",
    "Rizwan Ali",
  ];

  let nameIndex = 0;
  for (const branch of branches) {
    for (let i = 0; i < 2; i += 1) {
      const name = names[nameIndex % names.length] + (nameIndex >= names.length ? ` ${nameIndex}` : "");
      const email = `wak.driver${nameIndex + 1}@fleet.ai`;
      await db.execute(
        `INSERT INTO portal_driver_profiles
        (company_id, branch_id, driver_name, email, total_driving_hours, total_mileage, efficiency_score, safety_score, completion_rate)
        SELECT ?,?,?,?,?,?,?,?,?
        FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1 FROM portal_driver_profiles
          WHERE company_id = ? AND branch_id = ? AND driver_name = ?
        )`,
        [
          companyId,
          branch.branch_id,
          name,
          email,
          140 + nameIndex * 3,
          9000 + nameIndex * 250,
          78 + (nameIndex % 12),
          80 + (nameIndex % 12),
          82 + (nameIndex % 10),
          companyId,
          branch.branch_id,
          name,
        ]
      );
      nameIndex += 1;
    }
  }

  const [drivers] = await db.execute(
    "SELECT driver_id, driver_name, branch_id FROM portal_driver_profiles WHERE company_id = ? ORDER BY driver_id DESC LIMIT 20",
    [companyId]
  );

  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

  const routes = ["Route A", "Route B", "Route C", "Route D", "Route E", "Route F"];
  const fleets = ["AMXL X-Large", "CDV", "Step-van", "Rental", "EV", "Prime Van"];
  const statuses = ["Route", "Rescue", "Standby", "Unavailable", "Route", "In-progress"];
  const startTimes = ["09:15:00", "09:57:00", "10:15:00"];
  const endTimes = ["18:00:00", "17:50:00", "18:11:00"];

  for (const driver of drivers.slice(0, 8)) {
    for (let day = 0; day < 7; day += 1) {
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + day);
      const date = toDateText(dt);
      await db.execute(
        `INSERT INTO portal_driver_schedule
        (driver_id, schedule_date, route_name, fleet_assigned, station, start_time, end_time, status, work_block_rostered, schedule_association, voluntary_extra_time, notes)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,?
        FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1 FROM portal_driver_schedule
          WHERE driver_id = ? AND schedule_date = ?
        )`,
        [
          driver.driver_id,
          date,
          routes[(driver.driver_id + day) % routes.length],
          fleets[(driver.driver_id + day) % fleets.length],
          `WAK-${driver.branch_id}`,
          startTimes[day % startTimes.length],
          endTimes[day % endTimes.length],
          statuses[(driver.driver_id + day) % statuses.length],
          34 + (day % 4),
          day % 2,
          day % 3,
          "Standard Parcel",
          driver.driver_id,
          date,
        ]
      );
    }
  }

  const [countRows] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM portal_driver_schedule s
     INNER JOIN portal_driver_profiles p ON p.driver_id = s.driver_id
     WHERE p.company_id = ?`,
    [companyId]
  );

  console.log("WAK Builders driver schedules total:", countRows[0]?.total || 0);
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to seed WAK Builders drivers/schedules:", error.message);
    process.exit(1);
  });
