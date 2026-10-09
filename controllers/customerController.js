import Customer from "../models/customerModel.js";
import Table from "../models/tableModel.js";
import { ROLES, STATUS_CODES } from "../utils/constants.js";

import bcrypt from "bcrypt";
import verifyOtp from "../utils/verifyOtp.js";
import createOtp from "../utils/createOtp.js";
import { otpVerificationEamil } from "../utils/sendEmailOtp.js";
import e from "cors";

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

  // 1. Validation
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
    // 2. Check table availability
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

    // 3. Generate & Hash OTP
    const otp = createOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Send Verification Email
    await otpVerificationEamil({ otp, email });

    const exactMatchingCustomer = await Customer.findOne({
      email,
      name,
      mobile,
      date,
      time,
      duration,
      people,
      message,
    });

    if (exactMatchingCustomer) {
      const currentBookedIds = exactMatchingCustomer.bookedTables.map((id) =>
        id.toString(),
      );

      const newTableIds = tableIds.filter(
        (id) => !currentBookedIds.includes(id.toString()),
      );

      exactMatchingCustomer.pendingTableIds = newTableIds;
      exactMatchingCustomer.otp = otpHash;
      exactMatchingCustomer.otpExpiresAt = otpExpiresAt;
      exactMatchingCustomer.bookingStatus = "pending";
      exactMatchingCustomer.isVerified = false;

      await exactMatchingCustomer.save();
    } else {
      await Customer.create({
        name,
        email,
        mobile,
        date,
        time,
        duration,
        people,
        pendingTableIds: tableIds,
        bookedTables: [],
        message,
        otp: otpHash,
        otpExpiresAt,
        bookingStatus: "pending",
        isVerified: false,
      });
    }

    return res.status(STATUS_CODES.SUCCESS).json({
      message:
        "OTP sent successfully to your email. Please verify to confirm booking.",
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(STATUS_CODES.SERVER_ERROR).json({
      message: "Failed to process booking request",
      error: error.message,
    });
  }
};

// 2. Confirm Booking via OTP
export const confirmBooking = async (req, res) => {
  const { email, enterdOtp } = req.body;

  try {
    const customer = await Customer.findOne({ email });

    if (!customer) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: "Booking request not found." });
    }

    // 1. Check OTP Expiry
    if (new Date() > customer.otpExpiresAt) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: "OTP has expired. Please try booking again." });
    }

    // 2. Verify OTP Hash
    const isOtpValid = await bcrypt.compare(String(enterdOtp), customer.otp);
    if (!isOtpValid) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: "Invalid OTP code." });
    }

    if (customer.bookedTables.length > 0) {
      const newTableIds = customer.pendingTableIds;
      customer.bookedTables.push(...newTableIds);
      await Table.updateMany(
        { _id: { $in: newTableIds } },
        {
          bookingStatus: "booked",
          bookingDetails: customer._id,
          bookedByModel: "Customer",
        },
      );
    }

    // Customer Status Update
    customer.isVerified = true;
    customer.bookingStatus = "confirmed";
    customer.otp = null;
    customer.pendingTableIds = []; // Clear pending list

    await customer.save();

    // 4. Update Tables status in Database to "booked"
    await Table.updateMany(
      { _id: { $in: customer.bookedTables } },
      {
        bookingStatus: "booked",
        bookingDetails: customer._id,
        bookedByModel: "Customer",
      },
    );

    return res.status(STATUS_CODES.SUCCESS).json({
      success: true,
      message: "Booking confirmed successfully!",
    });
  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR).json({
      message: "Failed to confirm booking",
      error: error.message,
    });
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
