import { processUnverifiedClaims } from "../services/claimProcessingService.js";

export async function searchResolvedClaims(req, res) {
    try {
        const results = await processUnverifiedClaims();
        res.json({ results });
    } catch (err) {
        console.error("Error processing claims Google search:", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
