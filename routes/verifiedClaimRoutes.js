import express from "express";
import { createClaim, getAllClaims, getClaimById, updateClaimById, deleteClaim } from "../controllers/verifiedClaimController.js";
const router = express.Router();

// Create a new claim
router.post("/create", createClaim);

// Get all claims
router.get("/allClaims", getAllClaims);

// Get a specific claim by ID
router.get("/:id", getClaimById);

// Update claim
router.put("/update/:id", updateClaimById);

// Delete claim
router.delete("/delete/:id", deleteClaim);

export default router;

