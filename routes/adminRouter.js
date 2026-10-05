import express from "express";
import {
  register,
  login,
  verifyOtpHandler,
  addTable,
  bookTableByAdmin,
  removeBookedTable,
  getAllTables,
} from "../controllers/adminController.js";
import { loginMiddleware } from "../middlewares/loginMiddleware.js";

const adminRouter = express.Router();

// 1. Authentication & Registration Routes
adminRouter.post("/register", register);
adminRouter.post("/login", login);
adminRouter.post("/verify-otp", verifyOtpHandler);

// 2. Table Management Routes
adminRouter.post("/add-table", loginMiddleware, addTable);
adminRouter.get("/tables", loginMiddleware, getAllTables);

// 3. Admin Direct Booking & Unbooking Overrides
adminRouter.post("/book-table", loginMiddleware, bookTableByAdmin);
adminRouter.post("/remove-table", loginMiddleware, removeBookedTable);

export default adminRouter;
