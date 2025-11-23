import cron from "node-cron";
import VerifiedClaim from "./models/verifiedClaimModel.js";


// Delete old claims every day at midnight
export const deleteOldClaimsJob = () => {
  cron.schedule("0 0 * * *", async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const result = await VerifiedClaim.deleteMany({ createdAt: { $lt: cutoff } });
    console.log(`Deleted ${result.deletedCount} old claims`);
  });
};
