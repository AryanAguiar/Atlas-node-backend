import Claim from "../models/claimsModel.js";
import VerifiedClaim from "../models/verifiedClaimModel.js";
import { searchText } from "./searchText.js";
import { scrapeArticle } from "./scraper.js";
import pLimit from "p-limit";
import dotenv from "dotenv";

dotenv.config();

// Shared limit for scraping across all claims to prevent overwhelming network/resources
const scrapeLimit = pLimit(50);

async function processSingleClaim(claim) {
    try {
        // 1. Search
        const searchResults = await searchText(claim.resolvedClaim);
        const sourceUrls = searchResults.map(s => s.link);

        // 2. Scrape (with concurrency limit)
        const articles = (await Promise.all(
            sourceUrls.slice(0, 3).map(url => scrapeLimit(async () => {
                try {
                    const text = await scrapeArticle(url);
                    return { url, text };
                } catch {
                    return null;
                }
            }))
        )).filter(Boolean);

        const claimWithSources = {
            claim: claim.resolvedClaim,
            sources: searchResults,
            articles
        };

        // 3. Mock LLM / Verification
        // In a real scenario, we would call the LLM here.
        const verifiedData = {
            claim: claimWithSources.claim,
            verdict: "Unverified", // Default for mock
            score: Math.floor(Math.random() * 100),
            explanation: "This is a mock explanation generated because the LLM service is not connected.",
            explanation_snippet: "Mock snippet...",
            urls: claimWithSources.sources.map(s => s.link),
            sources: claimWithSources.sources
        };

        // 4. Save to Database
        const verifiedClaim = await VerifiedClaim.findOneAndUpdate(
            { claim: verifiedData.claim },
            verifiedData,
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        // 5. Update Original Claim
        await Claim.updateOne(
            { resolvedClaim: claim.resolvedClaim },
            { $set: { verified: true } }
        );

        return verifiedClaim;

    } catch (err) {
        console.error(`Error processing claim "${claim.resolvedClaim}":`, err);
        return null;
    }
}

export async function processUnverifiedClaims() {
    try {
        console.log("Processing unverified claims...");

        const claims = await Claim.find(
            {
                resolvedClaim: { $exists: true, $ne: "" },
                verified: { $ne: true }
            },
            { resolvedClaim: 1 }
        );

        if (!claims.length) {
            console.log("No unverified claims found.");
            return [];
        }

        console.log(`Found ${claims.length} unverified claims. Starting pipeline...`);

        // Run all claims in parallel
        const results = await Promise.all(claims.map(c => processSingleClaim(c)));

        const successful = results.filter(Boolean);
        console.log(`Successfully processed ${successful.length} claims.`);

        return successful;

    } catch (err) {
        console.error("Error in processUnverifiedClaims:", err);
        return [];
    }
}
