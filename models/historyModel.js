import mongoose from "mongoose";

const HistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // FIXED
  },
  article_title: String,
  result_summary: String,
  false_likelihood: Number,

  claim_ids: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Claim",
    }
  ],

  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("History", HistorySchema);
