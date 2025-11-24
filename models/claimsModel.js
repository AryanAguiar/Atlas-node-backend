import mongoose from "mongoose";

const claimSchema = new mongoose.Schema({
    // user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    originalClaim: { type: String, required: true },
    resolvedClaim: { type: String, required: true },
    label: { type: String },
    score: { type: Number },
    confidence: { type: String },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Claim", claimSchema);
