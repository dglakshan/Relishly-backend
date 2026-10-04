import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const otpVerificationEamil = ({ otp, email }) => {
  const transporter = nodemailer.createTransport({
    service: "gamil",
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const htmlContent = `
    <h2>Welcome to Relishly!</h2>
    <h1>Use this OTP to Verify your email</h1>
    <p>Your OTP is: <strong>${otp}</strong></p>
    <p>This OTP is valid for 10 minutes. Please do not share it with anyone.</p>
  `;

  const mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: "Email Verification OTP",
    html: htmlContent,
  };

  transporter.sendMail(mailOptions);
};
