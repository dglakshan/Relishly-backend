import Admin from "../models/adminModel.js";
import Customer from "../models/customerModel.js";
import bcrypt from "bcrypt";

const verifyOtp = async ({ otp, email, role }) => {
  try {
    let user = null;

    if (role === "customer") {
      user = await Customer.findOne({ email });
    } else if (role === "admin") {
      user = await Admin.findOne({ email });
    }

    if (!user || !user.otp) {
      return false;
    }

    const isMatch = bcrypt.compare(otp, user.otp);
    return isMatch;
  } catch (error) {
    console.error("OTP verification error:", error.message);
    return false;
  }
};

export default verifyOtp;
