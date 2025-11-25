import VerifiedClaim from "../models/verifiedClaimModel.js";

export const createVerifiedClaim = async (req, res) => {
    try {
        const {
            claim,
            verdict,
            score,
            explanation_snippet,
            urls,
            explanation,
            sources,
        } = req.body;

        if (!claim) {
            return res.status(400).json({ error: "Claim is required" });
        }

        // Check duplicates again (extra safety layer)
        const exists = await VerifiedClaim.findOne({ claim, verdict  });
        if (exists) {
            return res.status(409).json({
                error: "Verified claim already exists",
                id: exists._id,
            });
        }

        const newClaim = new VerifiedClaim({
            claim,
            verdict,
            score,
            explanation_snippet,
            urls,
            explanation,
            sources,
        });

        await newClaim.save();

        return res.status(201).json({
            message: "Verified claim created",
            claim: newClaim,
        });

    } catch (err) {
        console.error("Error creating verified claim:", err);
        res.status(500).json({ error: "Server error" });
    }
};

export const checkVerifiedClaim = async (req, res) => {
    try {
        const { claim } = req.query;

        if (!claim) {
            return res.status(400).json({ exists: false, error: "Claim is required" });
        }

        const existing = await VerifiedClaim.findOne({ claim });

        return res.json({ exists: !!existing });
    } catch (err) {
        console.error("Error checking verified claim:", err);
        res.status(500).json({ exists: false, error: "Server error" });
    }
};

export const getAllVerifiedClaims = async (req, res) => {
    try {
        const claims = await VerifiedClaim.find().sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: claims.length,
            claims
        });
    } catch (err) {
        console.error("Error fetching verified claims:", err);
        return res.status(500).json({
            success: false,
            message: "Server error fetching verified claims"
        });
    }
};

export const getVerifiedClaimById = async (req, res) => {
    try {
        const { id } = req.params;

        const claim = await VerifiedClaim.findById(id);

        if (!claim) {
            return res.status(404).json({
                success: false,
                message: "Verified claim not found"
            });
        }

        return res.status(200).json({
            success: true,
            claim
        });
    } catch (err) {
        console.error("Error fetching claim by ID:", err);
        return res.status(500).json({
            success: false,
            message: "Server error fetching claim"
        });
    }
};