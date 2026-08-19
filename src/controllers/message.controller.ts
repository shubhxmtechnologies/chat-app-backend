import { createMessageBatch, deleteMessageForEveryone, deleteMessageForMe, editMessage, getChatMessages } from "../services/message.service.js";
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
import { sendPushNotification } from "../services/push.service.js";
import { isUserOnline } from "../socket/onlineUsers.js";
import { envConfig } from "../config/env.js";
import { User } from "../models/user.model.js";


export const sendMessage = asyncHandler(async (req, res) => {
    const senderId = req.user?.userId;
    const { chatId, text, clientMessageId, replyTo } = req.body;
    if (typeof chatId !== "string" || typeof text !== "string") {
        throw new AppError("Invalid request data", 400);
    }
    if (clientMessageId !== undefined && (typeof clientMessageId !== "string" || clientMessageId.length > 100)) {
        throw new AppError("Invalid client message ID", 400);
    }

    // M4: Validate replyTo as ObjectId if provided
    const validatedReplyTo = replyTo && mongoose.isValidObjectId(replyTo) ? replyTo : undefined;

    if (!senderId) {
        throw new AppError("Unauthorized", 401);
    }

    const message = await createMessage({
        chatId,
        senderId,
        text,
        clientMessageId,
        ...(validatedReplyTo && { replyTo: validatedReplyTo }),
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

        const { chatId, messageType, clientMessageId, replyTo } = req.body;

        if (clientMessageId !== undefined && (typeof clientMessageId !== "string" || clientMessageId.length > 100)) {
            throw new AppError("Invalid client message ID", 400);
        }

        if (!mongoose.isValidObjectId(chatId)) {
            throw new AppError("Invalid chat ID", 400);
        }

        if (
            messageType !== "image" &&
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
                clientMessageId,
                replyTo
            });

            try {
                const chat = await getAuthorizedChat(chatId, senderId);
                const recipientId = chat.participants.find((p) => p.toString() !== senderId)?.toString();
                const io = req.app.get("io");

                if (recipientId) {
                    io.to(`user:${recipientId}`).emit("receive_message", message);
                    const sender = await User.findById(senderId).select("username");
                    const senderName = sender?.username || "Someone";
                    const mediaLabel = messageType === "voice" ? "🎤 Voice note" : "📷 Photo";
                    sendPushNotification(recipientId, {
                        title: `New message from ${senderName}`,
                        body: mediaLabel,
                        url: `${envConfig.CLIENT_ORIGIN}/chats/${chatId}`,
                        chatId,
                        senderId,
                        senderName,
                        tag: `chat_${chatId}`
                    }).catch(console.error);
                }
                io.to(`user:${senderId}`).emit("receive_message", message);
            } catch (error) {
                console.error("Failed to emit media message socket event:", error);
            }

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

export const updateMessage =
    asyncHandler(async (req, res) => {
        const userId = req.user?.userId;

        if (!userId) {
            throw new AppError(
                "Unauthorized",
                401
            );
        }

        const { messageId } =
            req.params;


        if (typeof messageId !== "string" ||
            !mongoose.isValidObjectId(messageId)) {
            throw new AppError(
                "Invalid message ID",
                400
            );
        }

        const { text } = req.body;

        const {
            message,
            chat,
        } = await editMessage(
            messageId,
            userId,
            text
        );

        const io =
            req.app.get("io");

        io.to(chat._id.toString()).emit(
            "message_edited",
            message
        );

        res.status(200).json({
            success: true,
            message,
        });
    });

export const removeMessageForEveryone =
    asyncHandler(async (req, res) => {
        const userId = req.user?.userId;

        if (!userId) {
            throw new AppError(
                "Unauthorized",
                401
            );
        }

        const { messageId } =
            req.params;


        if (typeof messageId !== "string" ||
            !mongoose.isValidObjectId(messageId)) {
            throw new AppError(
                "Invalid message ID",
                400
            );
        }
        const {
            message,
            chat,
        } =
            await deleteMessageForEveryone(
                messageId,
                userId
            );

        const io =
            req.app.get("io");

        io.to(chat._id.toString()).emit(
            "message_deleted_for_everyone",
            {
                messageId:
                    message._id.toString(),
            }
        );

        res.status(200).json({
            success: true,
            message:
                "Message deleted for everyone",
        });
    });

export const sendMessageBatch = asyncHandler(
    async (req, res) => {
        const senderId = req.user?.userId;

        if (!senderId) {
            throw new AppError(
                "Unauthorized",
                401
            );
        }

        const messages = req.body;

        if (!Array.isArray(messages)) {
            throw new AppError(
                "Request body must be an array",
                400
            );
        }
        for (const item of messages) {
            if (
                !item ||
                typeof item !== "object" ||
                typeof item.chatId !== "string" ||
                typeof item.text !== "string" ||
                typeof item.clientMessageId !== "string" ||
                item.clientMessageId.length > 100
            ) {
                throw new AppError("Invalid batch message payload", 400);
            }
        }

        // M8: All messages in a batch must target the same chatId
        // to prevent cross-chat spam through a single rate-limited request.
        const uniqueChatIds = new Set(messages.map((m: any) => m.chatId));
        if (uniqueChatIds.size > 1) {
            throw new AppError("All batch messages must target the same chat", 400);
        }
        
        const results =
            await createMessageBatch(
                senderId,
                messages
            );

        const io = req.app.get("io");

        for (const result of results) {
            if (!result.success) {
                continue;
            }

            const message = result.message!;


            io.to(
                message.chat.toString()
            ).emit(
                "receive_message",
                message
            );
        }

        res.status(200).json({
            success: true,
            results,
        });
    }
);

export const removeMessageForMe = asyncHandler(async (req, res) => {
    const userId = req.user?.userId;

    if (!userId) {
        throw new AppError("Unauthorized", 401);
    }

    const { messageId } = req.params;

    if (typeof messageId !== "string" || !mongoose.isValidObjectId(messageId)) {
        throw new AppError("Invalid message ID", 400);
    }

    await deleteMessageForMe(messageId, userId);

    res.status(200).json({
        success: true,
        message: "Message deleted for you",
    });
});