/**
 * Smoke test for Phase 5 Materials / Inventory (stored procedures + optional HTTP).
 * Run from fleetBack: node scripts/testMaterialsInventory.js
 *
 * Environment:
 *   SAFE_AUTO_DRAFT=1 — run construction_spAutoLowStockDraftPo only if branch has ≤ MAX_AUTO_DRAFT_SKUS (default 8) low-stock SKUs
 */
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import db from "../config/db.js";

dotenv.config();

const MAX_AUTO_DRAFT_SKUS = Number(process.env.MAX_AUTO_DRAFT_SKUS || 8);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function resolveScope(dbConn) {
  const [wak] = await dbConn.execute(
    `SELECT c.company_id, c.company_name, b.branch_id, b.branch_name
     FROM companies c
     INNER JOIN branches b ON b.company_id = c.company_id
     WHERE c.company_name LIKE ?
     ORDER BY c.company_id, b.branch_id
     LIMIT 1`,
    ["%Wak%"]
  );
  if (wak.length) {
    return {
      company_id: wak[0].company_id,
      branch_id: wak[0].branch_id,
      label: `${wak[0].company_name} / ${wak[0].branch_name}`,
    };
  }
  const [any] = await dbConn.execute(
    `SELECT c.company_id, c.company_name, b.branch_id, b.branch_name
     FROM companies c
     INNER JOIN branches b ON b.company_id = c.company_id
     ORDER BY c.company_id, b.branch_id
     LIMIT 1`
  );
  assert(any.length, "No company/branch row found — seed DB first.");
  return {
    company_id: any[0].company_id,
    branch_id: any[0].branch_id,
    label: `${any[0].company_name} / ${any[0].branch_name}`,
  };
}

async function pickActorUserId(dbConn, company_id) {
  const [rows] = await dbConn.execute(
    `SELECT u.id AS user_id
     FROM users u
     INNER JOIN lookup_roles lr ON lr.role_id = u.role_id
     WHERE lr.role_name IN ('SuperAdmin','Admin','ConstructionAdmin','CompanyAdmin')
     ORDER BY FIELD(lr.role_name,'SuperAdmin','Admin','ConstructionAdmin','CompanyAdmin'), u.id
     LIMIT 1`
  );
  if (rows.length) return rows[0].user_id;
  const [fallback] = await dbConn.execute(`SELECT id AS user_id FROM users ORDER BY id ASC LIMIT 1`);
  assert(fallback.length, "No users table row — cannot log usage / PO.");
  return fallback[0].user_id;
}

async function countLowStockSkus(dbConn, company_id, branch_id) {
  const [rows] = await dbConn.execute(
    `SELECT COUNT(*) AS n
     FROM materials m
     LEFT JOIN inventory i ON i.company_id = m.company_id AND i.branch_id = m.branch_id AND i.material_id = m.material_id
     WHERE m.company_id = ?
       AND m.branch_id = ?
       AND m.is_active = 1
       AND IFNULL(i.quantity_on_hand, 0) <= m.min_stock_qty`,
    [company_id, branch_id]
  );
  return Number(rows[0]?.n ?? 0);
}

async function runDbTests(scope, actorUserId, suffix) {
  const { company_id, branch_id } = scope;
  const code = `TEST-MAT-${suffix}`;

  console.log("\n--- Stored procedure tests ---");

  const [supRes] = await db.execute("CALL construction_spSupplierUpsert(?,?,?,?,?,?,?,?)", [
    0,
    company_id,
    branch_id,
    `Test Supplier ${suffix}`,
    "QA Bot",
    null,
    null,
    1,
  ]);
  const supplier_id = Number(supRes?.[0]?.[0]?.supplier_id);
  assert(supplier_id > 0, "Supplier upsert should return supplier_id");

  const [matRes] = await db.execute("CALL construction_spMaterialUpsert(?,?,?,?,?,?,?,?,?,?,?)", [
    0,
    company_id,
    branch_id,
    code,
    `Test Material ${suffix}`,
    "QA",
    "pcs",
    5,
    12.5,
    supplier_id,
    1,
  ]);
  const material_id = Number(matRes?.[0]?.[0]?.material_id);
  assert(material_id > 0, "Material upsert should return material_id");

  const [adjRes] = await db.execute("CALL construction_spInventoryAdjust(?,?,?,?,?)", [
    company_id,
    branch_id,
    material_id,
    50,
    12.5,
  ]);
  const qtyAfterAdj = Number(adjRes?.[0]?.[0]?.quantity_on_hand);
  assert(qtyAfterAdj === 50, `Expected qty 50 after adjust, got ${qtyAfterAdj}`);

  const [listRes] = await db.execute("CALL construction_spInventoryList(?,?,?)", [company_id, branch_id, "TEST-MAT"]);
  const list = listRes?.[0] || [];
  const row = list.find((r) => String(r.material_code) === code);
  assert(row, "Inventory list should include new material");
  assert(Number(row.stock_value) === 50 * Number(row.avg_unit_cost), "Stock value should match qty * avg cost");

  const poNum = `TEST-PO-${suffix}`;
  const [poRes] = await db.execute("CALL construction_spPurchaseOrderCreate(?,?,?,?,?,?,?,?,?,?,?)", [
    company_id,
    branch_id,
    supplier_id,
    poNum,
    new Date().toISOString().slice(0, 10),
    null,
    "QA smoke PO",
    material_id,
    10,
    12.5,
    actorUserId,
  ]);
  const po_id = Number(poRes?.[0]?.[0]?.po_id);
  assert(po_id > 0, "PO create should return po_id");

  const [poListRes] = await db.execute("CALL construction_spPurchaseOrdersList(?,?,?)", [company_id, branch_id, ""]);
  const poRows = poListRes?.[0] || [];
  assert(poRows.some((p) => String(p.po_number) === poNum), "PO list should include new PO");

  const [usageRes] = await db.execute("CALL construction_spMaterialUsageLog(?,?,?,?,?,?,?,?)", [
    company_id,
    branch_id,
    null,
    material_id,
    10,
    new Date().toISOString().slice(0, 10),
    "QA usage",
    actorUserId,
  ]);
  const usage_id = Number(usageRes?.[0]?.[0]?.usage_id);
  assert(usage_id > 0, "Usage log should return usage_id");

  const [afterUsage] = await db.execute("CALL construction_spInventoryAdjust(?,?,?,?,?)", [
    company_id,
    branch_id,
    material_id,
    0,
    null,
  ]);
  const qtyFinal = Number(afterUsage?.[0]?.[0]?.quantity_on_hand);
  assert(qtyFinal === 40, `Expected qty 40 after usage 10, got ${qtyFinal}`);

  let autoDraftRan = false;
  if (process.env.SAFE_AUTO_DRAFT === "1") {
    const lowN = await countLowStockSkus(db, company_id, branch_id);
    if (lowN <= MAX_AUTO_DRAFT_SKUS) {
      await db.execute("CALL construction_spAutoLowStockDraftPo(?,?,?)", [company_id, branch_id, actorUserId]);
      autoDraftRan = true;
      console.log(`Auto draft PO procedure completed (branch had ${lowN} low-stock SKUs, max ${MAX_AUTO_DRAFT_SKUS}).`);
    } else {
      console.log(
        `Skipped auto draft PO (branch has ${lowN} low-stock SKUs > ${MAX_AUTO_DRAFT_SKUS}). Set higher MAX_AUTO_DRAFT_SKUS or trim test data.`
      );
    }
  } else {
    console.log("Skipped auto draft PO (set SAFE_AUTO_DRAFT=1 to enable guarded run).");
  }

  console.log("DB tests passed:", {
    scope: scope.label,
    supplier_id,
    material_id,
    po_id,
    usage_id,
    qtyFinal,
    autoDraftRan,
  });
}

async function runHttpTests(scope, actorUserId) {
  const port = process.env.PORT || 5000;
  const base = `http://127.0.0.1:${port}/api/construction`;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.log("\n--- HTTP tests skipped (JWT_SECRET missing) ---");
    return;
  }

  const [u] = await db.execute(
    `SELECT u.id AS user_id, u.role_id, lr.role_name AS role
     FROM users u
     INNER JOIN lookup_roles lr ON lr.role_id = u.role_id
     WHERE u.id = ?
     LIMIT 1`,
    [actorUserId]
  );
  if (!u.length) {
    console.log("\n--- HTTP tests skipped (actor user not found) ---");
    return;
  }

  const token = jwt.sign(
    {
      user_id: u[0].user_id,
      role_id: u[0].role_id,
      role: u[0].role,
      company_ids: String(scope.company_id),
      branch_ids: String(scope.branch_id),
    },
    secret,
    { expiresIn: "15m" }
  );

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  console.log("\n--- HTTP tests ---");

  const invUrl = `${base}/materials/inventory?companyId=${scope.company_id}&branchId=${scope.branch_id}`;
  let res;
  try {
    res = await fetch(invUrl, { headers });
  } catch (e) {
    console.log("HTTP inventory GET failed (is fleetBack running on PORT?):", e.message);
    return;
  }
  assert(res.ok, `GET inventory expected 200, got ${res.status}`);
  const invJson = await res.json();
  assert(invJson.success === true, "inventory JSON success");
  assert(Array.isArray(invJson.data), "inventory data array");

  const supUrl = `${base}/materials/suppliers?companyId=${scope.company_id}&branchId=${scope.branch_id}`;
  const supRes = await fetch(supUrl, { headers });
  assert(supRes.ok, `GET suppliers expected 200, got ${supRes.status}`);
  const supJson = await supRes.json();
  assert(supJson.success === true, "suppliers JSON success");

  console.log("HTTP tests passed (inventory + suppliers GET).");
}

async function main() {
  const suffix = String(Date.now());
  const scope = await resolveScope(db);
  console.log("Using scope:", scope.label, `(company_id=${scope.company_id}, branch_id=${scope.branch_id})`);

  const actorUserId = await pickActorUserId(db, scope.company_id);
  console.log("Actor user_id for usage/PO:", actorUserId);

  await runDbTests(scope, actorUserId, suffix);
  await runHttpTests(scope, actorUserId);

  process.exit(0);
}

main().catch((err) => {
  console.error("TEST FAILED:", err.message);
  process.exit(1);
});
