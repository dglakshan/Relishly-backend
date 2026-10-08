import express from "express";
import { fetchAvilableTables } from "../controllers/tableController.js";

const tableRouter = express.Router();

tableRouter.get("", fetchAvilableTables);

export default tableRouter;
