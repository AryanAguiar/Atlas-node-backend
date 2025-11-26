import mongoose from "mongoose";

const claimSchema = new mongoose.Schema({
    originalClaim: { type: String, required: true },
    resolvedClaim: { type: String, required: true },
    label: { type: String },
    claim_score: { type: Number },
    verified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

// Only enforce unique original + resolved
claimSchema.index(
    { originalClaim: 1, resolvedClaim: 1 },
    { unique: true }
);

export default mongoose.model("Claim", claimSchema);
