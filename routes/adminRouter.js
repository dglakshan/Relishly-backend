import express from "express";
import {
  addTable,
  bookTableByAdmin,
  removeBookedTable,
  verifyOtp,
  getAllTables,
} from "../controllers/adminController.js";

const adminRouter = express.Router();

// Admin Authentication / OTP Verification
router.post("/verify-otp", verifyOtp);

// Table Management Routes
router.post("/add-table", addTable);
router.get("/tables", getAllTables);

// Admin Booking & Unbooking Overrides
router.post("/book-table", bookTableByAdmin);
router.post("/remove-table", removeBookedTable);

export default adminRouter;
