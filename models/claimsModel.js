import mongoose from "mongoose";

const claimSchema = new mongoose.Schema({
    // user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    originalClaim: { type: String, required: true },
    resolvedClaim: { type: String, required: true },
    label: { type: String },
    score: { type: Number },
    createdAt: { type: Date, default: Date.now }
});

claimSchema.index(
    { originalClaim: 1, resolvedClaim: 1, label: 1, score: 1, },
    { unique: true }
);

export default mongoose.model("Claim", claimSchema);
