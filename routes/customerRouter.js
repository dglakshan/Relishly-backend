import express from "express";
import {
  bookTable,
  checkBookedTable,
  confirmBooking,
  confirmCheckTable,
  removeTableBooking,
  confirmRemoveTable,
} from "../controllers/customerController.js";

const customerRouter = express.Router();

// 1. Create Booking Routes
customerRouter.post("/booking", bookTable);
customerRouter.post("/confirm-booking", confirmBooking);

// 2. View Booking Details Routes
customerRouter.post("/get-booking-details", checkBookedTable);
customerRouter.post("/confirm-check-tables", confirmCheckTable);

// 3. Cancel/Remove Booking Routes
customerRouter.post("/remove-booking", removeTableBooking);
customerRouter.post("/confirm-remove-booking", confirmRemoveTable);

export default customerRouter;
