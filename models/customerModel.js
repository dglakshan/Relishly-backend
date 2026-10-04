import mongoose from "mongoose";
import Table from "./tableModel.js";

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      minLength: 3,
      maxLength: 50,
      validate: {
        validator: (value) => /^[A-Za-z\s]+$/.test(value),
        message: "Name can only contain letters and spaces.",
      },
    },
    email: {
      type: String,
      required: true,
      validate: {
        validator: (value) =>
          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value),
        message: "Invalid email format.",
      },
    },
    mobile: {
      type: String,
      validate: {
        validator: (value) => /^[0-9]{10}$/.test(value),
        message: "Mobile number must be exactly 10 digits.",
      },
    },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    duration: {
      type: Number, // Duration in hours (e.g., 1 to 5)
      required: true,
      min: 1,
      max: 5,
    },
    people: { type: Number, required: true },
    bookedTables: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Table",
      },
    ],
    bookingStatus: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },
    message: { type: String },
    otp: { type: String },
    otpExpiresAt: { type: Date },
    isVerified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// TTL Index for OTP cleanup
customerSchema.index({ otpExpiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound text index for search
customerSchema.index({ name: "text", email: "text", mobile: "text" });

// Cascade release tables on deletion
customerSchema.pre("findOneAndDelete", async function () {
  const customer = await this.model.findOne(this.getQuery());
  if (customer && customer.bookedTables.length > 0) {
    await Table.updateMany(
      { _id: { $in: customer.bookedTables } },
      { bookingStatus: "available", bookingDetails: null, bookedByModel: null },
    );
  }
});

const Customer = mongoose.model("Customer", customerSchema);
export default Customer;
