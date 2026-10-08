import Table from "../models/tableModel.js";
import Admin from "../models/adminModel.js";
import Customer from "../models/customerModel.js";
import { STATUS_CODES, ROLES } from "../utils/constants.js";
import bcrypt from "bcrypt";
import { createToken } from "../utils/createToken.js";
import OTP from "../utils/createOtp.js";
import { otpVerificationEamil } from "../utils/sendEmailOTP.js";
import verifyOtp from "../utils/verifyOtp.js";

// 1. Admin Registration (Sends OTP to Email)
export const register = async (req, res) => {
  // const { authEmail, role } = req.user;
  const { fullname, email, mobile, password } = req.body;

  console.log(req.body);

  // const owner = await Admin.findOne({ email: authEmail });

  // if (owner)
  //   return res.status(STATUS_CODES.NOT_FOUND).json({
  //     success: false,
  //     message: "The owner could not find",
  //   });

  // if (owner.role != ROLES.SUPER_ADMIN)
  //   return res.status(STATUS_CODES.FORBIDDEN).json({
  //     success: false,
  //     message: "You are not eligible to get this acction",
  //   });

  if (!fullname || !email || !mobile || !password) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json({ success: false, message: "All fields are required." });
  }

  try {
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res
        .status(STATUS_CODES.FORBIDDEN)
        .json({ success: false, message: "Admin email already registered." });
    }

    const otp = await OTP();

    await otpVerificationEamil({ otp, email });

    // Hash password and OTP
    const passwordHash = await bcrypt.hash(password, 12);
    const otpHash = await bcrypt.hash(otp, 12);

    const newAdmin = await Admin.create({
      fullname: fullname,
      email,
      password: passwordHash,
      otp: otpHash,
      mobile,
      isVerified: false,
    });

    return res.status(STATUS_CODES.SUCCESS).json({
      success: true,
      message: "OTP has been sent. Please check your inbox to verify email.",
      adminId: newAdmin._id,
    });
  } catch (err) {
    console.log(err);
    return res.status(STATUS_CODES.SERVER_ERROR).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

// 2. Admin Login
export const login = async (req, res) => {
  const { email, password } = req.body;

  console.log(req.body);

  if (!email || !password) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json({ success: false, message: "All fields are required." });
  }

  try {
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res
        .status(STATUS_CODES.UNAUTHORIZED)
        .json({ success: false, message: "Invalid email" });
    }

    const comparePassword = await bcrypt.compare(password, admin.password);

    if (!comparePassword) {
      return res
        .status(STATUS_CODES.UNAUTHORIZED)
        .json({ success: false, message: "Invalid password." });
    }

    // Generate token passing payload details
    const authToken = createToken({
      id: admin._id,
      role: ROLES?.ADMIN || "admin",
    });

    return res.status(STATUS_CODES.SUCCESS).json({
      message: "Login successful",
      success: true,
      authToken,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (err) {
    return res
      .status(STATUS_CODES.SERVER_ERROR)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

// 3. Verify OTP for Registration / Booking / Removal
export const verifyOtpHandler = async (req, res) => {
  const { email, otp, type } = req.body;

  if (!email || !otp) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json({ success: false, message: "Email and OTP are required." });
  }

  try {
    const targetRole = ROLES?.ADMIN;
    const isMatch = await verifyOtp({ otp, email, role: targetRole });

    if (!isMatch) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ success: false, message: "Invalid or expired OTP." });
    }

    // Handle Registration OTP Verification
    if (type === "registration") {
      const admin = await Admin.findOne({ email });
      if (!admin) {
        return res
          .status(STATUS_CODES.NOT_FOUND)
          .json({ success: false, message: "Admin account not found." });
      }

      admin.isVerified = true;
      admin.otp = undefined;
      await admin.save();

      return res.status(STATUS_CODES.SUCCESS).json({
        success: true,
        message: "Email verified successfully! You can now log in.",
      });
    }

    // Handle Customer Booking Confirmation
    if (type === "booking") {
      const customer = await Customer.findOne({ email });
      if (customer) {
        customer.isVerified = true;
        customer.bookingStatus = "confirmed";
        customer.otp = undefined;
        await customer.save();
      }

      return res.status(STATUS_CODES.SUCCESS).json({
        success: true,
        message: "OTP verified successfully. Booking is confirmed.",
      });
    }

    // Handle Customer Booking Removal
    if (type === "removal") {
      const customer = await Customer.findOne({ email });
      if (customer) {
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
        await Customer.deleteOne({ email });
      }

      return res.status(STATUS_CODES.SUCCESS).json({
        success: true,
        message: "OTP verified successfully. Booking has been removed.",
      });
    }

    return res.status(STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: "Invalid action type provided.",
    });
  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR || 500).json({
      success: false,
      message: "Failed to verify OTP. Please try again later.",
      error: error.message,
    });
  }
};

// 4. Add New Table(s) - Single or Bulk
export const addTable = async (req, res) => {
  try {
    const { tables } = req.body;
    const tableList = Array.isArray(tables) ? tables : [req.body];

    if (!tableList || tableList.length === 0) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ success: false, message: "Please provide table details." });
    }

    const tableNumbers = tableList.map((t) => t.tableNumber);

    for (const item of tableList) {
      if (!item.tableNumber || !item.availableChairs || !item.tableType) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "All fields are required for every table.",
        });
      }
    }

    const existingTables = await Table.find({
      tableNumber: { $in: tableNumbers },
    });

    if (existingTables.length > 0) {
      const duplicateNumbers = existingTables.map((t) => t.tableNumber);
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Some table numbers already exist in the system.",
        duplicateTables: duplicateNumbers,
      });
    }

    const newTables = await Table.insertMany(tableList);

    return res.status(STATUS_CODES.SUCCESS || 201).json({
      success: true,
      message: `${newTables.length} table(s) added successfully!`,
      data: newTables,
    });
  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR || 500).json({
      success: false,
      message: "Failed to add table(s)",
      error: error.message,
    });
  }
};

// 5. Admin Direct Table Booking
export const bookTableByAdmin = async (req, res) => {
  const { adminEmail, tableNumbers } = req.body;

  if (!adminEmail || !tableNumbers || !Array.isArray(tableNumbers)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: "Admin email and an array of table numbers are required.",
    });
  }

  try {
    const admin = await Admin.findOne({ email: adminEmail });
    if (!admin) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ success: false, message: "Admin account not found." });
    }

    const tablesToBook = await Table.find({
      tableNumber: { $in: tableNumbers },
      bookingStatus: "available",
    });

    if (tablesToBook.length !== tableNumbers.length) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "One or more selected tables are already booked or invalid.",
      });
    }

    const tableIds = tablesToBook.map((t) => t._id);

    await Table.updateMany(
      { _id: { $in: tableIds } },
      {
        bookingStatus: "booked",
        bookingDetails: admin._id,
        bookedByModel: "Admin",
      },
    );

    admin.bookedTables = [
      ...new Set([...(admin.bookedTables || []), ...tableIds]),
    ];
    await admin.save();

    return res.status(STATUS_CODES.SUCCESS).json({
      success: true,
      message: "Tables booked successfully by Admin.",
    });
  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR || 500).json({
      success: false,
      message: "Failed to book tables",
      error: error.message,
    });
  }
};

// 6. Admin Direct Table Unbooking
export const removeBookedTable = async (req, res) => {
  const { tableNumbers } = req.body;

  if (!tableNumbers || !Array.isArray(tableNumbers)) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json({ success: false, message: "Table numbers array is required." });
  }

  try {
    const tables = await Table.find({ tableNumber: { $in: tableNumbers } });
    const tableIds = tables.map((t) => t._id);

    await Table.updateMany(
      { _id: { $in: tableIds } },
      {
        bookingStatus: "available",
        bookingDetails: null,
        bookedByModel: null,
      },
    );

    await Admin.updateMany(
      { bookedTables: { $in: tableIds } },
      { $pull: { bookedTables: { $in: tableIds } } },
    );

    return res.status(STATUS_CODES.SUCCESS).json({
      success: true,
      message: "Tables released successfully.",
    });
  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR || 500).json({
      success: false,
      message: "Failed to release tables",
      error: error.message,
    });
  }
};

// 7. Fetch All Tables
export const getAllTables = async (req, res) => {
  try {
    const tables = await Table.find().populate({
      path: "bookingDetails",
      select: "name email mobile",
    });

    return res.status(STATUS_CODES.SUCCESS).json({
      success: true,
      data: tables,
    });
  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR || 500).json({
      success: false,
      message: "Failed to fetch tables",
      error: error.message,
    });
  }
};
