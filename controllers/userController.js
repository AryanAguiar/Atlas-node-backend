import User from "../models/userModel.js";

export const addUser = async (req, res) => {
    try {
        const { UserName } = req.body;

        if (!UserName) {
            return res.status(400).json({ message: "UserName is required" });
        }

        const user = await User.create({ UserName });
        return res.status(201).json({
            message: "User created", user
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedUser = await User.findByIdAndDelete(id);

        if (!deleteUser) {
            return res.status(404).json({ message: "user not found" });
        }

        return res.status(200).json({ message: "user deleted successfully" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Server error" });
    }
}