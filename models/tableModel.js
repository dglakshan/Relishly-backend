import mongoose from "mongoose";

const tableSchema = new mongoose.Schema(
  {
    tableNumber: {
      type: Number,
      required: true,
      unique: true,
      validate: {
        validator: (value) => value > 0 && value <= 500,
        message: "Table number must be between 1 and 500.",
      },
    },
    size: { type: Number, required: true },
    availableChairs: { type: Number, required: true },
    tableType: { type: String, enum: ["indoor", "outdoor"], required: true },
    bookingStatus: {
      type: String,
      enum: ["available", "booked"],
      default: "available",
    },
    bookingDetails: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "bookedByModel",
      default: null,
    },
    bookedByModel: {
      type: String,
      enum: ["Customer", "Admin"],
      default: null,
    },
  },
  { timestamps: true },
);

const Table = mongoose.model("Table", tableSchema);
export default Table;
