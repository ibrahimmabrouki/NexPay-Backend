import { Schema, model, models } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    imageUrl: { type: String, required: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    refreshToken: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

const User = models.User || model("User", userSchema);
// Useris the name of the collection in MongoDB: it means automatically pluralized to "users" in the database
export default User;
