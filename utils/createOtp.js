export const OTP = () => {
  let otp = Math.floor(100000 + Math.random() * 900000);
  otp = otp.toString();

  return otp;
};

export default OTP;
