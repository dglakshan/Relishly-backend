import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const dbConnection = async function () {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
};

export default dbConnection;
