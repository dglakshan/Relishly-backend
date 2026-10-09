import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export const otpVerificationEamil = async ({ otp, email }) => {
  try {
    const htmlContent = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); border: 1px solid #f0f0f0;">
        
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, #d32f2f 0%, #ff6600 100%); padding: 30px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">Relishly</h1>
          <p style="color: #ffe0b2; margin: 5px 0 0 0; font-size: 14px; font-weight: 300;">Fine Dining & Table Reservation</p>
        </div>

        <!-- Main Content -->
        <div style="padding: 30px 25px; text-align: center; background-color: #ffffff;">
          <h2 style="color: #2c3e50; font-size: 22px; margin-top: 0; font-weight: 600;">Verify Your Email Address</h2>
          <p style="color: #666666; font-size: 15px; line-height: 1.5; margin-bottom: 25px;">
            Thank you for choosing Relishly! Use the One-Time Password (OTP) below to complete your table reservation.
          </p>

          <!-- OTP Box -->
          <div style="background: #fff8e1; border: 2px dashed #ff9800; border-radius: 10px; padding: 20px; margin: 20px 0; display: inline-block; width: 80%;">
            <span style="font-size: 12px; font-weight: 600; color: #e65100; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 8px;">Your Verification Code</span>
            <span style="font-size: 36px; font-weight: 800; color: #d32f2f; letter-spacing: 6px; font-family: monospace;">${otp}</span>
          </div>

          <!-- Expiry Warning -->
          <div style="margin-top: 25px; background-color: #fce4ec; border-radius: 6px; padding: 12px; display: inline-block;">
            <p style="color: #c2185b; font-size: 13px; margin: 0; font-weight: 500;">
              ⏳ This code is valid for <strong>10 minutes</strong>. Do not share it with anyone.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eeeeee;">
          <p style="color: #999999; font-size: 12px; margin: 0;">If you didn't request this email, please ignore it.</p>
          <p style="color: #999999; font-size: 12px; margin: 5px 0 0 0;">&copy; ${new Date().getFullYear()} Relishly Restaurant. All rights reserved.</p>
        </div>

      </div>
    `;

    const data = await resend.emails.send({
      from: "Relishly <onboarding@resend.dev>", // Default free testing sender
      to: [email],
      subject: "Relishly - Your Verification OTP",
      html: htmlContent,
    });

    console.log("Email sent successfully via Resend:", data);
    return data;
  } catch (error) {
    console.error("Failed to send OTP email:", error.message);
    throw error;
  }
};
