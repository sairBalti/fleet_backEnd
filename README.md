<<<<<<< HEAD
AI BASED flow
=======
# Fleet Backend

## Vehicle Stored Procedure Contracts

This module uses stored procedures for vehicle CRUD and listing to keep API behavior stable and consistent across frontend/backend changes.

### 1) `portal_spVehicleMainPageData`

- **Purpose:** Paginated vehicle listing with role scope, filters, sorting, and lookup payloads.
- **Inputs:**
  - `p_companyId INT`
  - `p_branchId INT`
  - `p_statusFilter VARCHAR(50)` (supports status name or status id as string)
  - `p_startDate DATE`
  - `p_endDate DATE`
  - `p_sortColumn VARCHAR(64)` (`registration`, `manufacturer`, `date_registered`)
  - `p_sortDirection VARCHAR(4)` (`ASC` / `DESC`)
  - `p_pageNumber INT`
  - `p_pageSize INT`
  - `p_loggedInUserId INT`
- **Resultset 1:** Vehicle rows with `totalRecords` column included per row.
- **Resultset 2:** Status lookup list (`id`, `name`).

### 2) `portal_spVehicleInsert`

- **Purpose:** Insert a new vehicle record.
- **Inputs:**
  - `p_company_id INT`
  - `p_branch_id INT`
  - `p_registration VARCHAR(100)`
  - `p_manufacturer VARCHAR(120)`
  - `p_model VARCHAR(120)`
  - `p_date_registered DATETIME`
  - `p_maintenance_interval_months INT`
  - `p_fuel_type_id INT`
  - `p_status_id INT`
- **Resultset 1:** Newly inserted `vehicle_id`.

### 3) `portal_spVehicleUpdate`

- **Purpose:** Update vehicle details by id.
- **Inputs:**
  - `p_vehicle_id INT`
  - `p_company_id INT`
  - `p_branch_id INT`
  - `p_registration VARCHAR(100)`
  - `p_manufacturer VARCHAR(120)`
  - `p_model VARCHAR(120)`
  - `p_date_registered DATETIME`
  - `p_maintenance_interval_months INT`
  - `p_fuel_type_id INT`
  - `p_status_id INT`
- **Resultsets:** none expected.

### 4) `portal_spVehicleGetById`

- **Purpose:** Fetch one vehicle with joined fuel/status labels.
- **Inputs:**
  - `p_vehicle_id INT`
- **Resultset 1:** Single row (or empty) with:
  - vehicle fields
  - `fuel_type`
  - `status`

### 5) `portal_spVehicleDelete`

- **Purpose:** Delete one vehicle by id.
- **Inputs:**
  - `p_vehicle_id INT`
- **Resultsets:** none expected.

### 6) `portal_spVehicleDeleteMultiple`

- **Purpose:** Delete multiple vehicles.
- **Inputs:**
  - `p_ids TEXT` (comma-separated ids, example: `1,2,3`)
- **Resultsets:** none expected.

## Setup

Run this script whenever you need to create or refresh fleet vehicle procedures:

- `node setupVehicleDb.js`

>>>>>>> 5318c69 (added new features)
