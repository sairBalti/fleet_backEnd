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
import { errorHandler } from "./middleware/errorHandler.js.js";

import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use("/api/companies", businessRoutes )
app.use("/api/vehicle", fleetRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", userRoute);
app.use("/protected", protectedRoutes);
app.use("/api/lookup", lookupRoutes)

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
;

