import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    userName: {
        type: "String",
        default: "null",
    }
})

const User = mongoose.model("User", UserSchema);
export default User;