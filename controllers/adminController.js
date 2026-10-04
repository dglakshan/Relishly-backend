import Table from "../models/tableModel.js";
import Admin from "../models/adminModel.js";
import Customer from "../models/customerModel.js";
import { STATUS_CODES } from "../utils/constants.js";
import bcrypt from "bcrypt";

// 1. Add New Table(s) - Single or Bulk
export const addTable = async (req, res) => {
  try {
    const { tables } = req.body;
    const tableList = Array.isArray(tables) ? tables : [req.body];

    if (!tableList || tableList.length === 0) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: "Please provide table details." });
    }

    const tableNumbers = tableList.map((t) => t.tableNumber);

    for (const item of tableList) {
      if (
        !item.tableNumber ||
        !item.size ||
        !item.availableChairs ||
        !item.tableType
      ) {
        return res.status(STATUS_CODES.BAD_REQUEST).json({
          message:
            "All fields (tableNumber, size, availableChairs, tableType) are required for every table.",
        });
      }
    }

    const existingTables = await Table.find({
      tableNumber: { $in: tableNumbers },
    });

    if (existingTables.length > 0) {
      const duplicateNumbers = existingTables.map((t) => t.tableNumber);
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        message: "Some table numbers already exist in the system.",
        duplicateTables: duplicateNumbers,
      });
    }

    const newTables = await Table.insertMany(tableList);

    return res.status(STATUS_CODES.SUCCESS || 201).json({
      message: `${newTables.length} table(s) added successfully!`,
      success: true,
      data: newTables,
    });
  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR || 500).json({
      message: "Failed to add table(s)",
      error: error.message,
    });
  }
};

// 2. Admin Direct Table Booking
export const bookTableByAdmin = async (req, res) => {
  const { adminEmail, tableNumbers } = req.body;

  if (!adminEmail || !tableNumbers || !Array.isArray(tableNumbers)) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json({
        message: "Admin email and an array of table numbers are required.",
      });
  }

  try {
    const admin = await Admin.findOne({ email: adminEmail });
    if (!admin) {
      return res
        .status(STATUS_CODES.NOT_FOUND)
        .json({ message: "Admin account not found." });
    }

    // Check availability in a single DB call
    const tablesToBook = await Table.find({
      tableNumber: { $in: tableNumbers },
      bookingStatus: "available",
    });

    if (tablesToBook.length !== tableNumbers.length) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({
        message: "One or more selected tables are already booked or invalid.",
      });
    }

    const tableIds = tablesToBook.map((t) => t._id);

    // Update table statuses and reference Admin ObjectId
    await Table.updateMany(
      { _id: { $in: tableIds } },
      {
        bookingStatus: "booked",
        bookingDetails: admin._id,
        bookedByModel: "Admin",
      },
    );

    // Store booked tables in Admin schema
    admin.bookedTables = [
      ...new Set([...(admin.bookedTables || []), ...tableIds]),
    ];
    await admin.save();

    return res.status(STATUS_CODES.SUCCESS).json({
      message: "Tables booked successfully by Admin.",
      success: true,
    });
  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR || 500).json({
      message: "Failed to book tables",
      error: error.message,
    });
  }
};

// 3. Admin Direct Table Unbooking
export const removeBookedTable = async (req, res) => {
  const { tableNumbers } = req.body;

  if (!tableNumbers || !Array.isArray(tableNumbers)) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json({ message: "Table numbers array is required." });
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

    // Pull released table IDs from Admin bookedTables array
    await Admin.updateMany(
      { bookedTables: { $in: tableIds } },
      { $pull: { bookedTables: { $in: tableIds } } },
    );

    return res.status(STATUS_CODES.SUCCESS).json({
      message: "Tables released successfully.",
      success: true,
    });
  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR || 500).json({
      message: "Failed to release tables",
      error: error.message,
    });
  }
};

// 4. Admin/Customer OTP Verification Handler
export const verifyOtp = async (req, res) => {
  const { email, otp, type } = req.body;

  if (!email || !otp) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json({ message: "Email and OTP are required." });
  }

  try {
    const customer = await Customer.findOne({ email });

    if (!customer || !customer.otp) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: "Invalid request or OTP expired." });
    }

    const isMatch = await bcrypt.compare(otp, customer.otp);
    if (!isMatch) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json({ message: "Invalid OTP. Please try again." });
    }

    if (type === "booking") {
      customer.isVerified = true;
      customer.bookingStatus = "confirmed";
      customer.otp = undefined;
      customer.otpExpiresAt = undefined;
      await customer.save();

      return res.status(STATUS_CODES.SUCCESS).json({
        message: "OTP verified successfully. Your booking is confirmed.",
        success: true,
      });
    } else if (type === "removal") {
      // Release tables referenced in customer schema
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

      return res.status(STATUS_CODES.SUCCESS).json({
        message: "OTP verified successfully. Your booking has been removed.",
        success: true,
      });
    }

    return res.status(STATUS_CODES.BAD_REQUEST).json({
      message: "Invalid action type provided.",
    });
  } catch (error) {
    return res.status(STATUS_CODES.SERVER_ERROR || 500).json({
      message: "Failed to verify OTP. Please try again later.",
      error: error.message,
    });
  }
};

// 5. Fetch All Tables (With Admin/Customer Population)
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
      message: "Failed to fetch tables",
      error: error.message,
    });
  }
};
