// import VerifiedClaim from "../models/verifiedClaimModel.js";
// // export const createClaim = async (req, res) => {
// //     try {
// //         const newClaim = new VerifiedClaim(req.body);
// //         await newClaim.save();
// //         res.status(201).json({
// //             message: "Claim saved successfully",
// //             data: newClaim,
// //         });
// //     } catch (error) {
// //         console.error("Error creating claim:", error);
// //         res.status(500).json({ error: "Failed to save claim" });
// //     }
// // };

// export const createClaim = async (req, res) => {
//     try {
//         const { claim, verdict, score, total_results, trusted_results, sources } = req.body;

//         if (!claim || !verdict) {
//             res.status(400).json({ error: "Claim and verdict are required" });
//         }

//         const newClaim = new VerifiedClaim({
//             claim,
//             verdict,
//             score,
//             total_results,
//             trusted_results,
//             sources,
//         });

//         await newClaim.save();

//         res.status(201).json({
//             message: "Claim saved successfully",
//             data: newClaim,
//         });
//     } catch (error) {
//         console.error("Error creating claim: ", error);
//         res.status(500).json({ error: "Failed to save claim" });
//     }
// }

// export const getAllClaims = async (req, res) => {
//     try {
//         const claims = await VerifiedClaim.find().sort({ createdAt: -1 });
//         res.status(200).json(claims);
//     } catch (error) {
//         console.error("Error fetching claims:", error);
//         res.status(500).json({ error: "Failed to fetch claims" });
//     }
// };

// export const getClaimById = async (req, res) => {
//     try {
//         const claim = await VerifiedClaim.findById(req.params.id);
//         if (!claim) {
//             return res.status(404).json({ message: "Claim not found" });
//         }
//         res.status(200).json(claim);
//     } catch (error) {
//         console.error("Error fetching claim:", error);
//         res.status(500).json({ error: "Failed to fetch claim" });
//     }
// };


// export const updateClaimById = async (req, res) => {
//     try {
//         const updatedClaim = await VerifiedClaim.findByIdAndUpdate(
//             req.params.id,
//             req.body,
//             { new: true, runValidators: true }
//         );

//         if (!updatedClaim) {
//             return res.status(404).json({ "message": "Claim not found" });
//         }

//         res.status(200).json({
//             message: "Claim updated successfully",
//             data: updatedClaim,
//         });
//     } catch (error) {
//         console.error("Error updating claim:", error);
//         res.status(500).json({ error: "Failed to update claim" });
//     }
// }

// export const deleteClaim = async (req, res) => {
//     try {
//         const deletedClaim = await VerifiedClaim.findByIdAndDelete(req.params.id);
//         if (!deletedClaim) {
//             return res.status(404).json({ message: "Claim not found" });
//         }

//         res.status(200).json({
//             message: "Claim deleted successfully",
//             data: deletedClaim,
//         });
//     } catch (error) {
//         console.error("Error deleting claim:", error);
//         res.status(500).json({ error: "Failed to delete claim" });
//     }
// }