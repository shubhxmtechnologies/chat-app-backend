import type { Request, Response } from "express";
import { User } from "../models/user.model.js";

import { asyncHandler } from "../utils/asyncHandler.util.js";
import { AppError } from "../utils/appError.util.js";
import { escapeRegex } from "../utils/regexEscape.util.js";
import {
    MEDIA_LIMITS,
    validateMedia,
} from "../utils/mediaValidation.util.js";

import {
    uploadBuffer,
    deleteAsset,
} from "../services/cloudinary.service.js";

import mongoose from "mongoose";
import { normalizeUsername } from "../utils/username.util.js";
import { 
    updateNameSchema, 
    updateEmailSchema, 
    changePasswordSchema, 
    updateBioSchema 
} from "../validators/profile.validator.js";
import type { IUser } from "../types/user.types.js";
import type { Document } from "mongoose";
import bcrypt from "bcryptjs";

const FIELD_CHANGE_LIMIT = 2;
const FIELD_CHANGE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks

function checkFieldChangeLimit(user: IUser & Document, field: string): void {
    const cutoff = new Date(Date.now() - FIELD_CHANGE_WINDOW_MS);
    const recentChanges = user.fieldChangeLog.filter(
        (entry) => entry.field === field && entry.changedAt > cutoff
    );
    if (recentChanges.length >= FIELD_CHANGE_LIMIT) {
        throw new AppError(
            `You can only change ${field} ${FIELD_CHANGE_LIMIT} times every 2 weeks.`,
            429
        );
    }
}

function recordFieldChange(user: IUser & Document, field: string): void {
    user.fieldChangeLog.push({ field, changedAt: new Date() });
}

export const uploadAvatar = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.userId;

        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        if (!req.file) {
            throw new AppError("Avatar is required", 400);
        }

        await validateMedia(
            req.file.buffer,
            MEDIA_LIMITS.avatar.allowedMimeTypes,
            MEDIA_LIMITS.avatar.maxSize
        );

        const user = await User.findById(userId);

        if (!user) {
            throw new AppError("User not found", 404);
        }
        
        checkFieldChangeLimit(user as any, "avatar");

        const previousAvatar = user.avatarPublicId;

        const upload = await uploadBuffer(
            req.file.buffer,
            `avatars/${userId}`,
            "image"
        );

        user.avatarUrl = upload.secureUrl;
        user.avatarPublicId = upload.publicId;
        
        recordFieldChange(user as any, "avatar");
        await user.save();

        if (
            previousAvatar &&
            previousAvatar !== upload.publicId
        ) {
            await deleteAsset(previousAvatar, "image");
        }

        res.status(200).json({
            success: true,
            avatarUrl: user.avatarUrl,
        });
    }
);

export const deleteAvatar = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.userId;

        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const user = await User.findById(userId);

        if (!user) {
            throw new AppError("User not found", 404);
        }

        checkFieldChangeLimit(user as any, "avatar");

        const previousAvatar = user.avatarPublicId;
        
        if (!previousAvatar) {
            throw new AppError("You don't have an avatar to delete", 400);
        }

        user.avatarUrl = null;
        user.avatarPublicId = null;

        recordFieldChange(user as any, "avatar");
        await user.save();
        
        await deleteAsset(previousAvatar, "image").catch((err) => {
            console.error("Failed to delete avatar from cloudinary:", err);
        });

        res.status(200).json({
            success: true,
            message: "Avatar deleted successfully",
        });
    }
);

export const updateBio = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.userId;

        if (!userId) {
            throw new AppError(
                "Unauthorized",
                401
            );
        }

        const parsed = updateBioSchema.safeParse(req.body);
        
        if (!parsed.success) {
            throw new AppError(
                parsed.error.issues[0]?.message ?? "Invalid bio data",
                400
            );
        }
        
        const normalizedBio = parsed.data.bio?.trim() || "";

        const user = await User.findById(userId);

        if (!user) {
            throw new AppError(
                "User not found",
                404
            );
        }

        user.bio =
            normalizedBio.length === 0
                ? null
                : normalizedBio;

        checkFieldChangeLimit(user as any, "bio");
        recordFieldChange(user as any, "bio");
        
        await user.save();

        res.status(200).json({
            success: true,
            bio: user.bio,
        });
    }
);

export const updateName = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.userId;

        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const parsed = updateNameSchema.safeParse(req.body);
        if (!parsed.success) {
            throw new AppError(
                parsed.error.issues[0]?.message ?? "Invalid name data",
                400
            );
        }

        const user = await User.findById(userId);
        if (!user) {
            throw new AppError("User not found", 404);
        }

        checkFieldChangeLimit(user as any, "name");

        user.name = {
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName ?? null,
        };

        recordFieldChange(user as any, "name");
        await user.save();

        res.status(200).json({
            success: true,
            name: user.name,
        });
    }
);

export const updateEmail = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.userId;

        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const parsed = updateEmailSchema.safeParse(req.body);
        if (!parsed.success) {
            throw new AppError(
                parsed.error.issues[0]?.message ?? "Invalid email data",
                400
            );
        }

        const normalizedEmail = parsed.data.email.trim().toLowerCase();

        const user = await User.findById(userId);
        if (!user) {
            throw new AppError("User not found", 404);
        }

        if (user.email === normalizedEmail) {
            throw new AppError("This is already your email", 400);
        }

        checkFieldChangeLimit(user as any, "email");

        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            throw new AppError("This email is already taken", 409);
        }

        user.email = normalizedEmail;
        
        recordFieldChange(user as any, "email");
        await user.save();

        res.status(200).json({
            success: true,
            email: user.email,
        });
    }
);

export const changePassword = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.userId;

        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const parsed = changePasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            throw new AppError(
                parsed.error.issues[0]?.message ?? "Invalid password data",
                400
            );
        }

        const user = await User.findById(userId);
        if (!user) {
            throw new AppError("User not found", 404);
        }

        checkFieldChangeLimit(user as any, "password");

        const isMatch = await bcrypt.compare(parsed.data.currentPassword, user.password);
        if (!isMatch) {
            throw new AppError("Incorrect current password", 401);
        }

        // The pre("save") hook will hash this new password
        user.password = parsed.data.newPassword;
        
        recordFieldChange(user as any, "password");
        await user.save();

        res.status(200).json({
            success: true,
            message: "Password changed successfully",
        });
    }
);





export const blockUser = asyncHandler(
    async (req, res) => {
        const currentUserId = req.user?.userId;
        const { userId } = req.params;

        if (!currentUserId) {
            throw new AppError("Unauthorized", 401);
        }
        if (typeof userId !== "string") {
            throw new AppError("Invalid user ID", 400);
        }
        if (!mongoose.isValidObjectId(userId)) {
            throw new AppError("Invalid user ID", 400);
        }

        const canonicalUserId = new mongoose.Types.ObjectId(
            userId
        ).toString();

        if (currentUserId === canonicalUserId) {
            throw new AppError(
                "You cannot block yourself",
                400
            );
        }

        const userExists = await User.exists({
            _id: canonicalUserId,
        });

        if (!userExists) {
            throw new AppError(
                "User not found",
                404
            );
        }

        await User.updateOne(
            {
                _id: currentUserId,
            },
            {
                $addToSet: {
                    blockedUsers: canonicalUserId,
                },
            }
        );

        res.status(200).json({
            success: true,
            message: "User blocked successfully",
        });
    }
);

export const unblockUser = asyncHandler(
    async (req, res) => {
        const currentUserId = req.user?.userId;
        const { userId } = req.params;

        if (!currentUserId) {
            throw new AppError("Unauthorized", 401);
        }

        if (!mongoose.isValidObjectId(userId)) {
            throw new AppError("Invalid user ID", 400);
        }

        await User.updateOne(
            {
                _id: currentUserId,
            },
            {
                $pull: {
                    blockedUsers: userId,
                },
            }
        );

        res.status(200).json({
            success: true,
            message: "User unblocked successfully",
        });
    }
);

export const getBlockedUsers = asyncHandler(
    async (req, res) => {
        const currentUserId = req.user?.userId;

        if (!currentUserId) {
            throw new AppError("Unauthorized", 401);
        }

        const user = await User.findById(currentUserId)
            .populate("blockedUsers", "username avatarUrl name")
            .lean();

        if (!user) {
            throw new AppError("User not found", 404);
        }

        res.status(200).json({
            success: true,
            blockedUsers: user.blockedUsers,
        });
    }
);

export const getProfile = asyncHandler(
    async (req, res) => {
        const currentUserId = req.user?.userId;

        if (!currentUserId) {
            throw new AppError("Unauthorized", 401);
        }

        const user = await User.findById(currentUserId)
            .select("-password -refreshToken -fieldChangeLog")
            .lean();

        if (!user) {
            throw new AppError("User not found", 404);
        }

        res.status(200).json({
            success: true,
            user,
        });
    }
);

export const searchUsers = asyncHandler(
    async (req: Request, res: Response) => {
        const currentUserId = req.user?.userId;

        if (!currentUserId) {
            throw new AppError("Unauthorized", 401);
        }

        const q = req.query.q;

        if (typeof q !== "string" || q.trim().length < 2 || q.trim().length > 50) {
            res.status(200).json({
                success: true,
                users: [],
            });
            return;
        }

        const pattern = new RegExp(escapeRegex(q.trim()), "i");

        const currentUser = await User.findById(currentUserId)
            .select("blockedUsers")
            .lean();

        const excludedIds = [
            currentUserId,
            ...(currentUser?.blockedUsers.map((id) => id.toString()) ?? []),
        ];

        const users = await User.find({
            _id: { $nin: excludedIds },
            blockedUsers: { $ne: currentUserId },
            username: pattern,
        })
            .select("username avatarUrl name")
            .limit(3);

        res.status(200).json({
            success: true,
            users,
        });
    }
); 