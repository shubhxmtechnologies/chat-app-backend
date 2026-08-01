import type { Request, Response } from "express";

import { User } from "../models/user.model.js";

import { asyncHandler } from "../utils/asyncHandler.util.js";
import { AppError } from "../utils/appError.util.js";

import {
    MEDIA_LIMITS,
    validateMedia,
} from "../utils/mediaValidation.util.js";

import {
    uploadBuffer,
    deleteAsset,
} from "../services/cloudinary.service.js";

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

        const oldAvatarPublicId = user.avatarPublicId;

        const upload = await uploadBuffer(
            req.file.buffer,
            `avatars/${userId}`,
            "image"
        );

        user.avatarUrl = upload.secureUrl;
        user.avatarPublicId = upload.publicId;

        try {
            await user.save();
        } catch (error) {
            await deleteAsset(upload.publicId, "image").catch(
                (cleanupError) => {
                    console.error(
                        "Failed to clean up new avatar after save failure:",
                        cleanupError
                    );
                }
            );
            throw error;
        }

        if (oldAvatarPublicId) {
            void deleteAsset(oldAvatarPublicId, "image").catch(
                (error) => {
                    console.error(
                        "Old avatar deletion failed:",
                        error
                    );
                }
            );
        }

        res.status(200).json({
            success: true,
            avatarUrl: user.avatarUrl,
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

        const { bio } = req.body;

        if (typeof bio !== "string") {
            throw new AppError(
                "Bio must be a string",
                400
            );
        }

        const normalizedBio = bio.trim();

        if (normalizedBio.length > 200) {
            throw new AppError(
                "Bio cannot exceed 200 characters",
                400
            );
        }

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

        await user.save();

        res.status(200).json({
            success: true,
            bio: user.bio,
        });
    }
);

export const updateUsername = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?.userId;

        if (!userId) {
            throw new AppError(
                "Unauthorized",
                401
            );
        }

        const { username } = req.body;

        if (typeof username !== "string") {
            throw new AppError(
                "Username is required",
                400
            );
        }

        const normalizedUsername =
            username
                .trim()
                .toLowerCase();

        if (
            normalizedUsername.length < 3 ||
            normalizedUsername.length > 30
        ) {
            throw new AppError(
                "Username must be between 3 and 30 characters",
                400
            );
        }

        if (
            !/^[a-zA-Z0-9_]+$/.test(
                normalizedUsername
            )
        ) {
            throw new AppError(
                "Username can only contain letters, numbers and underscores",
                400
            );
        }

        const user = await User.findById(userId);

        if (!user) {
            throw new AppError(
                "User not found",
                404
            );
        }

        if (user.usernameLocked) {
            throw new AppError(
                "Username can only be changed once.",
                403
            );
        }

        const existingUser =
            await User.findOne({
                username: normalizedUsername,
            });

        if (
            existingUser &&
            existingUser._id.toString() !==
            userId
        ) {
            throw new AppError(
                "This username is already taken.",
                409
            );
        }

        user.username = normalizedUsername;
        user.usernameLocked = true;

        await user.save();

        res.status(200).json({
            success: true,

            username: user.username,
        });
    }
);

