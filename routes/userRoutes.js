import express from "express";
import { addUser, deleteUser } from "../controllers/userController.js";

const router = express.Router();

router.post("/create", addUser);
router.delete("/delete/:id", deleteUser);

export default router;
