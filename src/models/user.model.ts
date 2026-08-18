import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

import type { IUser } from "../types/user.types.js";

export const DEFAULT_AVATAR_URL = "https://cutiedp.com/wp-content/uploads/2025/08/no-dp-image-4.webp";

const userSchema = new Schema<IUser>(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 5,
            maxlength: 14,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            minlength: 13,
            maxlength: 30,
        },

        password: {
            type: String,
            required: true,
            minlength: 8,
            maxlength: 128,
        },

        name: {
            firstName: {
                type: String,
                required: true,
                trim: true,
                minlength: 1,
                maxlength: 50,
            },
            lastName: {
                type: String,
                default: null,
                trim: true,
                maxlength: 50,
            },
        },

        refreshToken: {
            type: String,
            default: null,
        },
        avatarUrl: {
            type: String,
            default: DEFAULT_AVATAR_URL,
        },

        avatarPublicId: {
            type: String,
            default: null,
        },

        bio: {
            type: String,
            default: null,
            trim: true,
            maxlength: 200,
        },

        lastSeenAt: {
            type: Date,
            default: null,
        },
        blockedUsers: {
            type: [
                {
                    type: Schema.Types.ObjectId,
                    ref: "User",
                },
            ],
            default: [],
        },
        globalMute: {
            type: Boolean,
            default: false,
        },
        mutedChats: {
            type: [
                {
                    type: Schema.Types.ObjectId,
                    ref: "Chat",
                },
            ],
            default: [],
        },
        fieldChangeLog: {
            type: [
                {
                    field: { type: String, required: true },
                    changedAt: { type: Date, required: true },
                },
            ],
            default: [],
        },
        pushSubscription: {
            type: Object, // Stores endpoint and keys { p256dh, auth }
            default: null
        },
        failedLoginAttempts: {
            type: Number,
            default: 0,
        },
        lockUntil: {
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

userSchema.index({
    blockedUsers: 1,
});

export const User = mongoose.model<IUser>("User", userSchema);