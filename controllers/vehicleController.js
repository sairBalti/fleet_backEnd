import express from "express";
const router = express.Router();
import db from "../config/db.js";

// helper function to pass date 
const formatToMySQLDateTime = (input) => {
  const date = new Date(input);

  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// 
export const getVehicles = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const [rows] = await db.execute('CALL GetAllVehicles(?)', [companyId])

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('GetAllVehicles error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve vehicles', details: error.message });
  }
};
//

// get vehicle by id
export const getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query('CALL portal_spVehicleGetById(?)', [id]);
    res.json({ success: true, data: rows[0][0] || null }); // Assuming the first row is the result
  } catch (error) {
    console.error('Error fetching vehicle by ID:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch vehicle.' });
  }
};

export const createVehicle = async (req, res) => {
  let {
    registration,
    manufacturer,
    model,
    date_registered,
    maintenance_interval_months,
    fuel_type_id,
    status_id,
  } = req.body;

  console.log("Received date_registered:", date_registered);
  const companyId = req.user.company_id;
  const userId = req.user.user_id;
  const formattedDate = date_registered
    ? formatToMySQLDateTime(date_registered)
    : null;
  try {
    // Insert into database using the formatted date
    await db.execute('CALL portal_spVehicleInsert(?, ?, ?, ?, ?, ?, ?, ?)', [
      companyId,
      registration,
      manufacturer,
      model,
      formattedDate,
      maintenance_interval_months,
      fuel_type_id,
      status_id,
      userId,
    ]);

    res.status(201).json({ success: true, message: 'Vehicle added successfully' });
  } catch (error) {
    console.error('AddVehicle Error:', error);
    res.status(500).json({ success: false, message: 'Failed to add vehicle', details: error.message });
  }
};

export const updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;

    const { registration, manufacturer, model, date_registered, maintenance_interval_months, fuel_type_id, status_id } = req.body;
    await db.execute('CALL portal_spVehicleUpdate(?, ?, ?, ?, ?, ?, ?, ?)',
      [id, registration, manufacturer, model, date_registered, maintenance_interval_months, fuel_type_id, status_id

      ]
    );
    res.json({ success: true, message: 'Vehicle updated successfully' });
  }
  catch (error) {
    console.error('UpdateVehicle Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update vehicle', details: error.message });
  }
};

// Route to delete a vehicle using stored procedure
export const Deletevehicles = async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute('CALL portal_spVehicleDelete(?)', [id]);
    res.json({ success: true, message: 'Vehicle deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete vehicle', details: error });
  }
};

export const deleteMultipleVehicles = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No vehicle IDs provided for deletion' });
  }

  try {
    const idString = ids.join(',');
    await db.execute('CALL portal_spVehicleDeleteMultiple(?)', [idString]);
    res.json({ success: true, message: 'Vehicles deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete vehicles', details: error });
  }
};


// Get paginated, filtered, and sorted vehicles
export const getVehicleMainPageData = async (req, res) => {
  try {
    let {
      companyId,
      branchId,
      statusId,
      startDate,
      endDate,
      sortColumn,
      sortDirection,
      pageNumber,
      pageSize
    } = req.body;

    const loggedInUserId = req.user.user_id;

    // ✅ SAFE DEFAULTS
    pageNumber = Number(pageNumber) > 0 ? Number(pageNumber) : 1;
    pageSize = Number(pageSize) > 0 && Number(pageSize) <= 100 ? Number(pageSize) : 10;

    const allowedSortColumns = ["registration", "manufacturer", "date_registered"];
    if (!allowedSortColumns.includes(sortColumn)) {
      sortColumn = "registration";
    }

    sortDirection = sortDirection === "DESC" ? "DESC" : "ASC";

    const params = [
      companyId || null,
      branchId || null,
      statusId || null,
      startDate || null,
      endDate || null,
      sortColumn,
      sortDirection,
      pageNumber,
      pageSize,
      loggedInUserId
    ];

    const [result] = await db.execute(
      "CALL portal_spVehicleMainPageData(?,?,?,?,?,?,?,?,?,?)",
      params
    );

    const vehicles = result[0] || [];
    const statusList = result[1] || [];


    const totalRecords = vehicles.length ? vehicles[0].totalRecords : 0;

    const cleanedVehicles = vehicles.map(({ totalRecords, ...rest }) => rest);

    return res.status(200).json({
      success: true,
      data: cleanedVehicles,
      pagination: {
        pageNumber,
        pageSize,
        totalRecords
      },
      lookups: {
        statusList
      }
    });

  } catch (error) {
    console.error("Vehicle Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch vehicle list"
    });
  }
};


// router.post("/overview", async (req, res) => {
//   const {
//     sortBy = "maintenance_due_date",
//     sortDirection = "asc",
//     pageNumber = 1,
//     pageSize = 5
//   } = req.body;

//   try {
//     const [results] = await db.execute("CALL portal_spGetFleetOverviewStats(?, ?, ?, ?)", [
//       sortBy,
//       sortDirection,
//       pageNumber,
//       pageSize
//     ]);

//     const maintenanceAlerts = results[2] || [];

//     // Safely extract from the first record if it exists
//     const totalRecords = maintenanceAlerts.length > 0 ? maintenanceAlerts[0].totalRecords : 0;
//     const totalPages = maintenanceAlerts.length > 0 ? maintenanceAlerts[0].totalPages : 1;

//     // Remove totalRecords & totalPages from each row to avoid duplication
//     const cleanAlerts = maintenanceAlerts.map(({ totalRecords, totalPages, ...rest }) => rest);

//     res.json({
//       summaryStats: results[0][0],
//       fuelDistribution: results[1],
//       maintenanceAlerts: cleanAlerts,
//       totalRecords,
//       totalPages
//     });

//   } catch (error) {
//     console.error("Fleet overview error:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });
// router.get("/inspection_list", async (req, res) => {
//   try {
//     const [results] = await db.query("CALL portal_spGetFleetInspectionDetails()");

//     const inspections = results[0];        // Inspection summaries
//     const ratings = results[1];            // All ratings
//     const documents = results[2];          // All documents
//     const ratingGuide = results[3];        // Rating guide

//     // Organize data by inspection ID
//     const finalData = inspections.map((inspection) => {
//       const inspectionId = inspection.inspection_id;

//       return {
//         inspectionInfo: inspection,
//         ratings: ratings.filter(r => r.inspection_id === inspectionId),
//         documents: documents.filter(d => d.inspection_id === inspectionId),
//         rating_guide: ratingGuide
//       };
//     });

//     res.json(finalData);
//   } catch (error) {
//     console.error("Error fetching inspection list:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// // Insert Fleet Inspection
// router.post("/Addinspections", async (req, res) => {
//   try {
//     const {
//       vehicle_id,
//       inspector_name,
//       inspection_date,
//       inspection_result,
//       overall_score,
//       notes,
//       actions_taken,
//       ratings,
//       documents,
//     } = req.body;

//     // call SP
//     const [rows] = await db.query(
//       `CALL InsertFleetInspection(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         vehicle_id,
//         inspector_name,
//         inspection_date,
//         inspection_result,
//         overall_score,
//         notes,
//         actions_taken,
//         JSON.stringify(ratings),   // {"Brakes":4,"Engine":5}
//         JSON.stringify(documents), // [{"file_name":"x","file_path":"y"}]
//       ]
//     );

//     res.status(201).json({ message: "Inspection inserted successfully" });
//   } catch (error) {
//     console.error("Error inserting inspection:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });


