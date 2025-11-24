import express from "express";
// import { processNewsArticle } from "../controllers/claimsController.js";
import { processChunks, getClaimsWithVerification } from "../controllers/claimsControllerV2.js";
const router = express.Router();
 
router.post("/processChunks", processChunks);
router.get("/claimsWithVerification", getClaimsWithVerification);
export default router;
