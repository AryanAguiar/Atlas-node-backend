import Claim from "../models/claimsModel.js";
import VerifiedClaim from "../models/verifiedClaimModel.js";
import { searchText } from "./searchText.js";
import { scrapeArticle } from "./scraper.js";
import pLimit from "p-limit";
import dotenv from "dotenv";

dotenv.config();

export async function processUnverifiedClaims() {
    try {
        console.log("Processing unverified claims...");

        // 1. Get all claims that are NOT verified
        const claims = await Claim.find(
            {
                resolvedClaim: { $exists: true, $ne: "" },
                verified: { $ne: true }
            },
            { resolvedClaim: 1 }
        ).limit(1);//remove limit in production

        if (!claims.length) {
            console.log("No unverified claims found.");
            return [];
        }

        console.log(`Found ${claims.length} unverified claims.`);

        // 2. Run async searches in parallel
        const searches = await Promise.all(
            claims.map(c => searchText(c.resolvedClaim))
        );

        // 3. Format output
        const limit = pLimit(5); // Limit to 5 concurrent scrapes

        const claimsWithSources = await Promise.all(
            claims.map(async (c, idx) => {
                const sourceUrls = searches[idx].map(s => s.link);

                // scrape top 3 articles with concurrency limit
                const articles = (await Promise.all(
                    sourceUrls.slice(0, 3).map(url => limit(async () => {
                        try {
                            const text = await scrapeArticle(url);
                            return { url, text };
                        } catch {
                            return null;
                        }
                    }))
                )).filter(Boolean);


                return {
                    claim: c.resolvedClaim,
                    sources: searches[idx],
                    articles
                };
            })
        );


        // 4. --- MOCK LLM INTERACTION ---
        console.log("---------------------------------------------------");
        console.log("DATA SENT TO LLM:");
        console.log(JSON.stringify(claimsWithSources, null, 2));
        console.log("---------------------------------------------------");

        // In a real scenario, we would POST `claimsWithSources` to the Python LLM.
        // const llmResponse = await fetch(process.env.PYTHON_LLM_URL, {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify({ claims: claimsWithSources })
        // });
        // const verifiedClaimsData = await llmResponse.json();

        // MOCK DATA GENERATION
        const verifiedClaimsData = claimsWithSources.map(item => ({
            claim: item.claim,
            verdict: "Unverified", // Default for mock
            score: Math.floor(Math.random() * 100),
            explanation: "This is a mock explanation generated because the LLM service is not connected.",
            explanation_snippet: "Mock snippet...",
            urls: item.sources.map(s => s.link),
            sources: item.sources
        }));
        // -----------------------------

        // 5. Save to Database & Update Original Claims
        const savedClaims = [];
        const processedClaimTexts = [];

        for (const data of verifiedClaimsData) {
            const verifiedClaim = await VerifiedClaim.findOneAndUpdate(
                { claim: data.claim }, // Upsert based on claim text
                data,
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
            savedClaims.push(verifiedClaim);
            processedClaimTexts.push(data.claim);
        }

        // Update original claims to verified: true
        if (processedClaimTexts.length > 0) {
            await Claim.updateMany(
                { resolvedClaim: { $in: processedClaimTexts } },
                { $set: { verified: true } }
            );
            console.log(`Successfully processed and verified ${processedClaimTexts.length} claims.`);
        }

        return savedClaims;

    } catch (err) {
        console.error("Error in processUnverifiedClaims:", err);
        return [];
    }
}
