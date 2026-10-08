import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const otpVerificationEamil = async ({ otp, email }) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail", // Fixed typo (was "gamil")
      auth: {
        user: process.env.EMAIL_USER, // Matches your .env key
        pass: process.env.EMAIL_APP_PASSWORD, // Matches your .env key
      },
    });

    const htmlContent = `
      <h2>Welcome to Relishly!</h2>
      <h1>Use this OTP to Verify your email</h1>
      <p>Your OTP is: <strong>${otp}</strong></p>
      <p>This OTP is valid for 10 minutes. Please do not share it with anyone.</p>
    `;

    const mailOptions = {
      from: `Relishly <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Email Verification OTP",
      html: htmlContent,
    };

    // Clean Promise-based await execution
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully: " + info.response);
    return info;
  } catch (error) {
    console.error("Failed to send OTP email:", error.message);
    throw error;
  }
};
