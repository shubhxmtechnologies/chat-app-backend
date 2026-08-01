import { getChatMessages } from "../services/message.service.js";
import { createMessage } from "../services/message.service.js";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import { AppError } from "../utils/appError.util.js";
import type { Request, Response } from "express";
import { getAuthorizedChat } from "../services/chat.service.js";
import {
    MESSAGE_MEDIA,
    validateMedia,
} from "../utils/mediaValidation.util.js";
import {
    deleteAsset,
    uploadBuffer,
} from "../services/cloudinary.service.js";
import mongoose from "mongoose";


export const sendMessage = asyncHandler(async (req, res) => {
    const senderId = req.user?.userId;
    const { chatId, text } = req.body;

    if (!senderId) {
        throw new AppError("Unauthorized", 401);
    }

    const message = await createMessage({
        chatId,
        senderId,
        text
    });

    res.status(201).json({
        success: true,
        message,
    });
});

export const getMessages = asyncHandler<
    { chatId: string },
    any,
    any,
    { before?: string }
>(
    async (req, res) => {
        const userId = req.user?.userId;
        const { chatId } = req.params;
        const { before } = req.query;

        if (!userId) {
            throw new AppError("Unauthorized", 401);
        }

        const result = await getChatMessages(
            chatId,
            userId,
            before
        );

        res.status(200).json({
            success: true,
            messages: result.messages,
            nextCursor: result.nextCursor,
        });
    }
);

export const sendMediaMessage = asyncHandler(
    async (req: Request, res: Response) => {
        const senderId = req.user?.userId;

        if (!senderId) {
            throw new AppError("Unauthorized", 401);
        }

        if (!req.file) {
            throw new AppError("Media file is required", 400);
        }

        const { chatId, messageType } = req.body;

        if (!mongoose.isValidObjectId(chatId)) {
            throw new AppError("Invalid chat ID", 400);
        }

        if (
            messageType !== "image" &&
            messageType !== "sticker" &&
            messageType !== "voice"
        ) {
            throw new AppError("Invalid message type", 400);
        }

        const mediaConfig =
            MESSAGE_MEDIA[
            messageType as keyof typeof MESSAGE_MEDIA
            ];
        await getAuthorizedChat(chatId, senderId);

        await validateMedia(
            req.file.buffer,
            mediaConfig.validation.allowedMimeTypes,
            mediaConfig.validation.maxSize
        );

        let upload: { secureUrl: string; publicId: string } | null = null;

        try {
            upload = await uploadBuffer(
                req.file.buffer,
                `${mediaConfig.folder}/${chatId}`,
                mediaConfig.resourceType
            );

            const message = await createMessage({
                chatId,
                senderId,
                messageType,
                mediaUrl: upload.secureUrl,
                mediaPublicId: upload.publicId,
            });

            res.status(201).json({
                success: true,
                message,
            });
        } catch (error) {
            if (upload) {
                await deleteAsset(
                    upload.publicId,
                    mediaConfig.resourceType
                ).catch((cleanupError) => {
                    console.error(
                        "Failed to clean up orphaned media:",
                        cleanupError
                    );
                });
            }

            throw error;
        }
    }
);