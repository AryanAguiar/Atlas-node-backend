import mongoose from "mongoose";

const SearchResultItemSchema = new mongoose.Schema({
    title: { type: String, required: true },
    link: { type: String, required: true },
    snippet: { type: String },
});

const SearchResultSchema = new mongoose.Schema(
    {
        query: { type: String, required: true, unique: true, trim: true },
        results: [SearchResultItemSchema],
    },
    { timestamps: true }
);

export default mongoose.model("SearchResult", SearchResultSchema);
