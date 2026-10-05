import mongoose from "mongoose";
import Table from "./tableModel.js";

const adminSchema = new mongoose.Schema(
  {
    fullname: {
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
    password: {
      type: String,
      required: true,
    },
    otp: { type: String },
    otpExpiresAt: { type: Date },
    isVerified: { type: Boolean, default: false },
    bookedTables: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Table",
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// TTL index for OTP cleanup
adminSchema.index({ otpExpiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound text index
adminSchema.index({ name: "text", email: "text", mobile: "text" });

// Cascade release tables on deletion
adminSchema.pre("findOneAndDelete", async function () {
  const admin = await this.model.findOne(this.getQuery());
  if (admin && admin.bookedTables.length > 0) {
    await Table.updateMany(
      { _id: { $in: admin.bookedTables } },
      { bookingStatus: "available", bookingDetails: null, bookedByModel: null },
    );
  }
});

const Admin = mongoose.model("Admin", adminSchema);
export default Admin;
