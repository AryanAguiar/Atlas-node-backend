import mongoose from "mongoose";

const SuspiciousSchema = new mongoose.Schema({
  keyword: { type: String, required: true },
  category: {
    type: String,
    enum: ["health", "politics", "science", "conspiracy", "general"],
    default: "general",
  },
  severity: { type: Number, min: 1, max: 10, default: 5 },
  examples: [String],
});

export default mongoose.model("SuspiciousKeyword", SuspiciousSchema);
