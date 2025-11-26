import mongoose from "mongoose";

const SourceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  link: { type: String, required: true, trim: true },
  snippet: { type: String, trim: true },
});

const verifiedClaimSchema = new mongoose.Schema(
  {
    claim: { type: String, required: true, trim: true },
    verdict: {
      type: String,
      enum: [
        "Likely True",
        "Likely False",
        "Uncertain",
        "Unverified",
        "Partially True",
        "Partially False",
        "Very Likely False",
      ],
      default: "Unverified",
    },

    score: { type: Number, min: 0, max: 100, default: 0 },

    explanation_snippet: { type: String, default: null },

    urls: [{ type: String, trim: true }],

    explanation: { type: String, default: null },
    sources: [SourceSchema],
  },
  { timestamps: true }
);

verifiedClaimSchema.index(
  { claim: 1, verdict: 1, },
  { unique: true }
);

export default mongoose.model("VerifiedClaim", verifiedClaimSchema);
