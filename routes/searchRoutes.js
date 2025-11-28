import express from "express";
import { searchResolvedClaims } from "../controllers/searchClaims.js";

const router = express.Router();

router.get("/claims/search-google", searchResolvedClaims);

export default router;
