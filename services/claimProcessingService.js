import { callPythonVerifyAll } from "./callPythonLLM.js";

export async function processUnverifiedClaims() {
    try {
        console.log("Processing unverified claims using Python...");

        const verifiedResults = await callPythonVerifyAll();

        for (const verified of verifiedResults) {
            await VerifiedClaim.findOneAndUpdate(
                { claim: verified.claim },
                verified,
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );

            await Claim.updateOne(
                { resolvedClaim: verified.claim },
                { $set: { verified: true } }
            );
        }

        console.log(`Successfully saved ${verifiedResults.length} verified claims.`);

        return verifiedResults;

    } catch (err) {
        console.error("Error:", err);
        return [];
    }
}
