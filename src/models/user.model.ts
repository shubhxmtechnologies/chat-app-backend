import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

import type { IUser } from "../types/user.types.js";

const userSchema = new Schema<IUser>(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },

        password: {
            type: String,
            required: true,
        },

        refreshToken: {
            type: String,
            default: null,
        },
        avatarUrl: {
            type: String,
            default: null,
        },

        avatarPublicId: {
            type: String,
            default: null,
        },

        bio: {
            type: String,
            default: null,
            trim: true,
            maxlength: 250,
        },

        usernameLocked: {
            type: Boolean,
            default: false,
        },
        lastSeenAt: {
            type: Date,
            default: null,
        },
    },

    {
        timestamps: true,
    }
);

userSchema.pre("save", async function () {
    if (!this.isModified("password")) {
        return;
    }

    this.password = await bcrypt.hash(this.password, 12);
});

export const User = mongoose.model<IUser>("User", userSchema);