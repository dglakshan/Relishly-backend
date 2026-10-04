import express from "express";
import dbConnection from "./config/db.js";
import dotenv from "dotenv";

import cors from "cors";
import customerRouter from "./routes/customerRouter.js";
import { crosOptions } from "./config/crosOptions.js";
import adminRouter from "./routes/adminRouter.js";

dotenv.config();

const app = express();

// 1. Database Connection
dbConnection();

// 2. Global Middlewares
app.use(cors(crosOptions)); // Place CORS before body parsers
app.use(express.json());

// 3. API Routes
app.use("/api/customer", adminRouter);
app.use("/api/customer", customerRouter);

// 4. Server Listener
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
