import Customer from "../models/customerModel.js";
import Table from "../models/tableModel.js";
import { ROLES, STATUS_CODES } from "../utils/constants.js";

import bcrypt from "bcrypt";
import verifyOtp from "../utils/verifyOtp.js";
import createOtp from "../utils/createOtp.js";
import { otpVerificationEamil } from "../utils/sendEmailOTP.js";

// 1. Create a New Table Booking & Send OTP
export const bookTable = async (req, res) => {
  const {
    name,
    email,
    mobile,
    date,
    time,
    duration,
    people,
    tableNumbers,
    message,
  } = req.body;

  // Validation
  if (
    !name ||
    !email ||
    !mobile ||
    !date ||
    !time ||
    !duration ||
    !people ||
    !Array.isArray(tableNumbers) ||
    tableNumbers.length === 0
  ) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json({ message: "All required fields must be provided." });
  }

  try {
    // Check if requested tables exist and are available
    const existingTables = await Table.find({
      tableNumber: { $in: tableNumbers },
      bookingStatus: "available",
    });

    if (existingTables.length !== tableNumbers.length) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        message:
          "One or more selected tables are either already booked or invalid.",
        availableTables: existingTables,
      });
    }

    const tableIds = existingTables.map((t) => t._id);

    // Generate & Hash OTP
    const otp = createOtp();
    await otpVerificationEamil({ otp, email });
    const otpHash = await bcrypt.hash(otp, 10);

    // Set OTP Expiry to 10 minutes from now
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Create Customer Document
    const newCustomer = await Customer.create({
      name,
      email,
      mobile,
      date,
      time,
      duration,
      people,
      bookedTables: tableIds,
      message,
      otp: otpHash,
      otpExpiresAt,
      bookingStatus: "pending",
      isVerified: false,
    });

    // Update Tables to "booked" and assign Customer reference
    await Table.updateMany(
      { _id: { $in: tableIds } },
      {
        bookingStatus: "booked",
        bookingDetails: newCustomer._id,
        bookedByModel: "Customer",
      },
    );

    return res.status(STATUS_CODES.SUCCESS).json({
      message:
        "OTP sent successfully to your email. Please verify to confirm booking.",
      success: true,
    });
  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR).json({
      message: "Failed to process booking",
      error: error.message,
    });
  }
};

// 2. Confirm Booking via OTP
export const confirmBooking = async (req, res) => {
  const { email, enterdOtp } = req.body;

  if (!email || !enterdOtp) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json({ message: "Email and OTP are required" });
  }

  try {
    const isMatch = await verifyOtp({
      otp: enterdOtp,
      email,
      role: ROLES.CUSTOMER,
    });

    if (!isMatch) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: "Invalid or expired OTP" });
    }

    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: "Booking record not found" });
    }

    // Confirm booking & clear OTP
    customer.bookingStatus = "confirmed";
    customer.isVerified = true;
    customer.otp = undefined;
    customer.otpExpiresAt = undefined;
    await customer.save();

    return res.status(STATUS_CODES.SUCCESS).json({
      message: "Booking confirmed successfully!",
      success: true,
    });
  } catch (error) {
    return res
      .status(STATUS_CODES.SERVER_ERROR)
      .json({ message: error.message });
  }
};

// 3. Request OTP to View Existing Booking Details
export const checkBookedTable = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json({ message: "Email is required" });
  }

  try {
    const customer = await Customer.findOne({ email });

    if (!customer) {
      return res.status(STATUS_CODES.NOT_FOUND).json({
        message: "No booking found for the provided email address.",
      });
    }

    const otp = createOtp();
    await otpVerificationEamil({ otp, email });

    const otpHash = await bcrypt.hash(otp, 10);
    customer.otp = otpHash;
    customer.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await customer.save();

    return res.status(STATUS_CODES.SUCCESS).json({
      message:
        "OTP sent successfully to your email. Please verify to view details.",
      success: true,
    });
  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR).json({
      message: "Failed to send OTP email",
      error: error.message,
    });
  }
};

// 4. Verify OTP & Fetch Customer Booking Details
export const confirmCheckTable = async (req, res) => {
  const { email, enterdOtp } = req.body;

  if (!email || !enterdOtp) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json({ message: "Email and OTP are required" });
  }

  try {
    const isMatch = await verifyOtp({
      otp: enterdOtp,
      email,
      role: ROLES.CUSTOMER,
    });

    if (!isMatch) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: "Invalid or expired OTP" });
    }

    const customer = await Customer.findOne({ email }).populate({
      path: "bookedTables",
      select: "tableNumber size availableChairs tableType",
    });

    if (!customer) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: "Customer booking not found" });
    }

    return res.status(STATUS_CODES.SUCCESS).json({
      message: "Booking details retrieved successfully",
      success: true,
      customer,
      bookedTables: customer.bookedTables,
    });
  } catch (error) {
    return res
      .status(STATUS_CODES.SERVER_ERROR)
      .json({ message: error.message });
  }
};

// 5. Request OTP to Cancel/Remove Booking
export const removeTableBooking = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json({ message: "Email is required" });
  }

  try {
    const customer = await Customer.findOne({ email });

    if (!customer) {
      return res.status(STATUS_CODES.NOT_FOUND).json({
        message: "No booking found for the provided email.",
      });
    }

    const otp = createOtp();
    await otpVerificationEamil({ otp, email });

    const otpHash = await bcrypt.hash(otp, 10);
    customer.otp = otpHash;
    customer.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await customer.save();

    return res.status(STATUS_CODES.SUCCESS).json({
      message: "OTP sent successfully to your email to confirm cancellation.",
      success: true,
    });
  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR).json({
      message: "Failed to send OTP email",
      error: error.message,
    });
  }
};

// 6. Verify OTP & Delete Booking (Release Tables)
export const confirmRemoveTable = async (req, res) => {
  const { email, enterdOtp } = req.body;

  if (!email || !enterdOtp) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json({ message: "Email and OTP are required" });
  }

  try {
    const isMatch = await verifyOtp({
      otp: enterdOtp,
      email,
      role: ROLES.CUSTOMER,
    });

    if (!isMatch) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: "Invalid or expired OTP" });
    }

    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: "Customer not found" });
    }

    // Release tables in Table collection
    if (customer.bookedTables && customer.bookedTables.length > 0) {
      await Table.updateMany(
        { _id: { $in: customer.bookedTables } },
        {
          bookingStatus: "available",
          bookingDetails: null,
          bookedByModel: null,
        },
      );
    }

    // Delete customer record
    await Customer.deleteOne({ email });

    return res.status(STATUS_CODES.SUCCESS).json({
      message: "Booking cancelled and tables released successfully",
      success: true,
    });
  } catch (error) {
    return res
      .status(STATUS_CODES.SERVER_ERROR)
      .json({ message: error.message });
  }
};
