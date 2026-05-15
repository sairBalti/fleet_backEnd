// index.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

import fleetRoutes from "./routes/fleetRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoute from "./routes/userRoutes.js"
import protectedRoutes from "./routes/protectedRoutes.js";
import businessRoutes from "./routes/businessRoutes.js"
import lookupRoutes from "./routes/lookupRoutes.js"
import demoRequestRoutes from "./routes/demoRequestRoutes.js";
import portalRoutes from "./routes/portalRoutes.js";
import reportsRoutes from "./routes/reportsRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import maintenanceRoutes from "./routes/maintenanceRoutes.js";
import constructionRoutes from "./routes/constructionRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js.js";
import { startConstructionAutomationScheduler } from "./services/constructionAutomationService.js";

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/companies", businessRoutes )
app.use("/api/vehicle", fleetRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", userRoute);
app.use("/protected", protectedRoutes);
app.use("/api/lookup", lookupRoutes)
app.use("/api/demo-requests", demoRequestRoutes);
app.use("/api/portal", portalRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/construction", constructionRoutes);

app.use(errorHandler);

/** Match fleetFront `src/utils/api.js` dev default (`http://localhost:5002`). */
const PORT = process.env.PORT || 5002;
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  startConstructionAutomationScheduler();
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\n❌ Port ${PORT} is already in use (another Node process is still listening).\n` +
        `   Common causes:\n` +
        `   • Another Cursor terminal still has "nodemon" or "node index.js" running — switch tabs and press Ctrl+C.\n` +
        `   • Nodemon crashed but another tab already bound the port.\n` +
        `   Fix from fleetBack folder:  npm run kill-port\n` +
        `   Then:  npm run dev\n`
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});

