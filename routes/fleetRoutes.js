import express from "express";
const router = express.Router();
import * as vehicleController from "../controllers/vehicleController.js";
import verifyToken from "../middleware/verifyToken.js";

router.use(verifyToken);

router.post("/vehiclePaging", vehicleController.getVehicleMainPageData);
router.post("/delete-multiple", vehicleController.deleteMultipleVehicles);
router.get("/", vehicleController.getVehicles);
router.post("/", vehicleController.createVehicle);
router.get("/:id", vehicleController.getVehicleById);
router.put("/:id", vehicleController.updateVehicle);
router.delete("/:id", vehicleController.Deletevehicles);



export default router;


// // helper function to pass date 
// const formatToMySQLDateTime = (input) => {
//   const date = new Date(input);

//   const pad = (n) => String(n).padStart(2, '0');
//   const year = date.getFullYear();
//   const month = pad(date.getMonth() + 1);
//   const day = pad(date.getDate());
//   const hours = pad(date.getHours());
//   const minutes = pad(date.getMinutes());
//   const seconds = pad(date.getSeconds());

//   return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
// };

// // Route to get all vehicles using stored procedure
// router.get('/Allvehicles', async (req, res) => {
//   try {
//     const [results] = await db.execute('CALL GetAllVehicles()');
//     let vehicle_list = results[0];

//     // Format each vehicle's date_registered
//     vehicle_list = vehicle_list.map((vehicle) => {
//       if (vehicle.date_registered) {
//         vehicle.date_registered = formatToMySQLDateTime(vehicle.date_registered);
//       }
//       return vehicle;
//     });

//     res.json(vehicle_list);
//   } catch (error) {
//     console.error('GetAllVehicles error:', error);
//     res.status(500).json({ error: 'Failed to retrieve vehicles', details: error.message });
//   }
// });
// // Route to add a new vehicle using stored procedure
// router.post('/Addvehicles', async (req, res) => {
//   let {
//     registration,
//     manufacturer,
//     model,
//     date_registered,
//     maintenance_interval_months,
//     fuel_type,
//     status,
//   } = req.body;

//   console.log("Received date_registered:", date_registered);

//   // Date validation: Check if date_registered is in a valid format
//   if (!date_registered || isNaN(Date.parse(date_registered))) {
//     return res.status(400).json({ error: 'Invalid date format', received: date_registered });
//   }

//   try {
//     // Parse and format the date registered to "YYYY-MM-DD HH:mm:ss"
//     let dateObj = new Date(date_registered);
//     let formattedDate = dateObj.getFullYear() + "-" +
//       String(dateObj.getMonth() + 1).padStart(2, '0') + "-" +
//       String(dateObj.getDate()).padStart(2, '0') + " " +
//       String(dateObj.getHours()).padStart(2, '0') + ":" +
//       String(dateObj.getMinutes()).padStart(2, '0') + ":" +
//       String(dateObj.getSeconds()).padStart(2, '0');

//     console.log("Formatted date_registered:", formattedDate);

//     // Insert into database using the formatted date
//     await db.execute('CALL AddVehicle(?, ?, ?, ?, ?, ?, ?)', [
//       registration,
//       manufacturer,
//       model,
//       formattedDate,
//       maintenance_interval_months,
//       fuel_type,
//       status,
//     ]);

//     res.status(201).json({ message: 'Vehicle added successfully' });
//   } catch (error) {
//     console.error('AddVehicle Error:', error);
//     res.status(500).json({ error: 'Failed to add vehicle', details: error.message });
//   }
// });

// router.put('/Updatevehicles/:id', async (req, res) => {
//   const { id } = req.params;
//   let { registration, manufacturer, model, date_registered, maintenance_interval_months, fuel_type, status } = req.body;

//   try {
//     // Parse and format the date_registered into "YYYY-MM-DD HH:mm:ss"
//     let dateObj = new Date(date_registered);
//     let formattedDate = dateObj.getFullYear() + "-" +
//       String(dateObj.getMonth() + 1).padStart(2, '0') + "-" +
//       String(dateObj.getDate()).padStart(2, '0') + " " +
//       String(dateObj.getHours()).padStart(2, '0') + ":" +
//       String(dateObj.getMinutes()).padStart(2, '0') + ":" +
//       String(dateObj.getSeconds()).padStart(2, '0');

//     // Update the vehicle in the database using the formatted date
//     await db.execute('CALL UpdateVehicle(?, ?, ?, ?, ?, ?, ?, ?)',
//       [id, registration, manufacturer, model, formattedDate, maintenance_interval_months, fuel_type, status]
//     );

//     res.json({ message: 'Vehicle updated successfully' });
//   } catch (error) {
//     console.error('UpdateVehicle Error:', error);
//     res.status(500).json({ error: 'Failed to update vehicle', details: error.message });
//   }
// });

// // Route to delete a vehicle using stored procedure
// router.delete('/Deletevehicles/:id', async (req, res) => {
//   const { id } = req.params;
//   try {
//     await db.execute('CALL DeleteVehicle(?)', [id]);
//     res.json({ message: 'Vehicle deleted successfully' });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to delete vehicle', details: error });
//   }
// });

// router.post('/vehicles/delete-multiple', async (req, res) => {
//   const { ids } = req.body;
//   if (!Array.isArray(ids) || ids.length === 0) {
//     return res.status(400).json({ error: 'No vehicle IDs provided for deletion' });
//   }

//   try {
//     const idString = ids.join(',');
//     await db.execute('CALL DeleteMultipleVehicles(?)', [idString]);
//     res.json({ message: 'Vehicles deleted successfully' });
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to delete vehicles', details: error });
//   }
// });
// // get vehicle by id
// router.get('/vehicles/:id', async (req, res) => {
//   const { id } = req.params;
//   try {
//     const [rows] = await db.query('CALL GetVehicleById(?)', [id]);
//     let vehicle = rows[0][0]
//     if (vehicle && vehicle.date_registered) {
//       vehicle.date_registered = formatToMySQLDateTime(vehicle.date_registered);
//     }
//     res.json(vehicle); // Assuming the first row is the result
//   } catch (error) {
//     console.error('Error fetching vehicle by ID:', error);
//     res.status(500).json({ message: 'Failed to fetch vehicle.' });
//   }
// });

// // Get paginated, filtered, and sorted paginated vehicles
// router.post("/vehiclePaging", async (req, res) => {
//   const {
//     status,
//     start,
//     end,
//     searchText, //  plan to use this later
//     sortColumn,
//     sortDirection = 'ASC',
//     page = 1,
//     pageSize = 20
//   } = req.body;
//   const formattedStart = start ? formatToMySQLDateTime(new Date(start)) : null;
//   const formattedEnd = end ? formatToMySQLDateTime(new Date(end)) : null;

//   try {
//     const [rows] = await db.execute(
//       "CALL portal_spVehiclemainPageData(?, ?, ?, ?, ?, ?, ?)",
//       [
//         status || null,
//         formattedStart || null,
//         formattedEnd || null,
//         sortColumn || null,
//         sortDirection,
//         parseInt(page),
//         parseInt(pageSize)
//       ]
//     );

//     let vehicle_list = rows[0];

//     // Format each vehicle's date_registered
//     vehicle_list = vehicle_list.map((vehicle) => {
//       if (vehicle.date_registered) {
//         vehicle.date_registered = formatToMySQLDateTime(vehicle.date_registered);
//       }
//       return vehicle;
//     });

//     const totalRecords = vehicle_list.length > 0 ? vehicle_list[0].totalRecords : 0;
//     const totalPages = Math.ceil(totalRecords / pageSize);

//     res.json({
//       data: vehicle_list,
//       total: totalRecords,
//       totalPages,
//       currentPage: parseInt(page),
//       pageSize: parseInt(pageSize)

//     });
//   } catch (error) {
//     console.error("Error fetching vehicles:", error);
//     res.status(500).json({ error: "Failed to fetch vehicles" });
//   }
// });
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


// export default router;