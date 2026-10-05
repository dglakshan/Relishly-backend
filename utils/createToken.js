import jwt from "jsonwebtoken";
import { ROLES } from "./constants.js";
import dotenv from "dotenv";

dotenv.config();

export const createToken = ({ fullname, email }) => {
  const payLoad = {
    fullname,
    email,
    role: ROLES.ADMIN,
  };

  const token = jwt.sign(payLoad, process.env.JWT_SECRET, { expiresIn: "5d" });

  return token;
};
