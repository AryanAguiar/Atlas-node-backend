import express from "express";
import { checkVerifiedClaim, createVerifiedClaim, getAllVerifiedClaims, getVerifiedClaimById } from "../controllers/verifiedClaimController.js";

const router = express.Router();

// Create a new claim
router.post("/create", createVerifiedClaim);

// Get all claims
router.get("/allClaims", getAllVerifiedClaims);

// Check a claim
router.get("/check", checkVerifiedClaim);

// Get a specific claim by ID
router.get("/:id", getVerifiedClaimById);


export default router;

