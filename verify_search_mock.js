import mongoose from "mongoose";
import dotenv from "dotenv";
import { processUnverifiedClaims } from "./services/claimProcessingService.js";
import VerifiedClaim from "./models/verifiedClaimModel.js";
import Claim from "./models/claimsModel.js";

dotenv.config();

async function runVerification() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        // Ensure there is at least one resolved claim to test with
        const testClaim = await Claim.findOne({ resolvedClaim: { $exists: true, $ne: "" }, verified: { $ne: true } });
        let claimId;

        if (!testClaim) {
            console.log("No unverified resolved claims found to test. Creating one...");
            const newClaim = await Claim.create({
                originalClaim: "Test original claim automation",
                resolvedClaim: "This is a test resolved claim for automation " + Date.now(),
                verified: false
            });
            claimId = newClaim._id;
        } else {
            claimId = testClaim._id;
            console.log("Found existing unverified claim:", testClaim.resolvedClaim);
        }

        console.log("Calling automation service directly...");
        const results = await processUnverifiedClaims();
        console.log(`Service returned ${results.length} processed claims.`);

        console.log("Verifying data in VerifiedClaim collection...");
        const verifiedClaims = await VerifiedClaim.find({}).sort({ createdAt: -1 }).limit(1);

        if (verifiedClaims.length > 0) {
            console.log("SUCCESS: Found verified claim in DB:", verifiedClaims[0]);
        } else {
            console.error("FAILURE: No verified claims found in DB.");
        }

        console.log("Verifying original Claim status...");
        const updatedClaim = await Claim.findById(claimId);
        if (updatedClaim.verified === true) {
            console.log("SUCCESS: Original claim marked as verified.");
        } else {
            console.error("FAILURE: Original claim NOT marked as verified. Status:", updatedClaim.verified);
        }

    } catch (err) {
        console.error("Verification failed:", err);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from DB");
    }
}

runVerification();
