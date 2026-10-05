import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { STATES } from "mongoose";
import { STATUS_CODES } from "../utils/constants.js";

dotenv.config();

export const loginMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(STATUS_CODES.UNAUTHORIZED).json({
      success: false,
      message: "Unauthorized access.Token not provideded",
    });

  const authToken = authHeader.split(" ")[1];

  try {
    jwt.verify(authToken, process.env.JWT_SECRET, (err, decoded) => {
      if (!decoded)
        return res
          .status(STATUS_CODES.FORBIDDEN)
          .json({ success: false, message: "Invalid or expired token" });

      req.user = decoded;
      next();
    });
  } catch (err) {
    throw err;
  }
};
