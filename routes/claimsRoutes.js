import express from "express";
// import { processNewsArticle } from "../controllers/claimsController.js";
import { processNewsArticle, processChunks } from "../controllers/claimsControllerV2.js";
const router = express.Router();
 
router.post("/process", processNewsArticle);
router.post("/processChunks", processChunks);

export default router;
