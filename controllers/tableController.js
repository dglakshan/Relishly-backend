import Table from "../models/tableModel.js";
import { STATUS_CODES } from "../utils/constants.js";

export const fetchAvilableTables = async (req, res) => {
  try {
    const avilableTables = await Table.find({
      bookingStatus: "available",
    }).select("tableNumber availableChairs tableType");

    res
      .status(STATUS_CODES.SUCCESS)
      .json({ success: true, tables: avilableTables });
  } catch (error) {
    res.status(STATUS_CODES.SERVER_ERROR).json({
      success: false,
      message: "Failed to fetch available tables",
      error: error.message,
    });
  }
};
