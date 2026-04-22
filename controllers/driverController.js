// controllers/driverController.js
export const createDriver = (req, res) => {
  try {
    res.status(201).json({ message: "Driver created successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error creating driver", error });
  }
};