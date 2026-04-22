// controllers/maintenanceController.js
export const update = (req, res) => {
  try {
    res.status(200).json({ message: "Maintenance updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error updating maintenance", error });
  }
};