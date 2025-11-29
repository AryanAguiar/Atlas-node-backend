import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import verifiedClaimRoutes from "./routes/verifiedClaimRoutes.js";
import claimsRoutes from "./routes/claimsRoutes.js";
import cors from "cors";
import { deleteOldClaimsJob } from "./cronJob.js";
import searchRoutes from "./routes/searchRoutes.js";
dotenv.config();

const app = express();

app.use(express.json());
app.use(cors({ origin: "*" }));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Database Connected");
    deleteOldClaimsJob();
  })
  .catch((err) => console.error("Database connection error:", err));

// Routes
app.use("/api/verifiedClaims", verifiedClaimRoutes);
app.use("/api/claims", claimsRoutes);
app.use("/api/search", searchRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
