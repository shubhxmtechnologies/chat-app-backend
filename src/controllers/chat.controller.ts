import { Chat } from "../models/chat.model.js";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import { AppError } from "../utils/appError.util.js";
import {
    getUnreadCountsForUser,
} from "../services/message.service.js";

import mongoose from "mongoose";

import { User } from "../models/user.model.js";
import { isBlockedEitherWay, getBlockDirection } from "../services/user.service.js";
import { deleteChatForMe, deleteChatForEveryone } from "../services/chat.service.js";


export const createOrGetChat = asyncHandler(
    async (req, res) => {
        const currentUserId = req.user?.userId;
        const { otherUserId } = req.body;

        if (!currentUserId) {
            throw new AppError("Unauthorized", 401);
        }

        if (
            typeof otherUserId !== "string" ||
            !mongoose.isValidObjectId(otherUserId)
        ) {
            throw new AppError("Invalid user ID", 400);
        }

        /*
         * Canonicalize both IDs.
         * ObjectId.toString() always gives canonical lowercase hex.
         */
        const canonicalCurrentUserId =
            new mongoose.Types.ObjectId(
                currentUserId
            ).toString();

        const canonicalOtherUserId =
            new mongoose.Types.ObjectId(
                otherUserId
            ).toString();

        if (
            canonicalCurrentUserId ===
            canonicalOtherUserId
        ) {
            throw new AppError(
                "You cannot create a chat with yourself",
                400
            );
        }

        const otherUserExists = await User.exists({
            _id: canonicalOtherUserId,
        });

        if (!otherUserExists) {
            throw new AppError(
                "User not found",
                404
            );
        }
        const blocked = await isBlockedEitherWay(
            currentUserId,
            canonicalOtherUserId
        );

        if (blocked) {
            throw new AppError(
                "You cannot create a chat with this user",
                403
            );
        }
        const participantKey = [
            canonicalCurrentUserId,
            canonicalOtherUserId,
        ]
            .sort()
            .join(":");

        const existingChat = await Chat.findOne({
            participantKey,
        });

        if (existingChat) {
            if (existingChat.deletedFor.includes(new mongoose.Types.ObjectId(currentUserId))) {
                await Chat.updateOne(
                    { _id: existingChat._id },
                    { $pull: { deletedFor: currentUserId } }
                );
            }
            res.status(200).json({
                success: true,
                chat: existingChat,
            });

            return;
        }

        try {
            const chat = await Chat.create({
                participants: [
                    canonicalCurrentUserId,
                    canonicalOtherUserId,
                ],
                participantKey,
                lastMessage: null,
                createdBy: canonicalCurrentUserId,
            });

            res.status(201).json({
                success: true,
                chat,
            });
        } catch (error: unknown) {
            /*
             * Two requests may race:
             *
             * A → lookup → absent
             * B → lookup → absent
             * A → creates
             * B → unique index rejects
             *
             * Return A's chat to B.
             */
            if (
                typeof error === "object" &&
                error !== null &&
                "code" in error &&
                error.code === 11000
            ) {
                const existingChat =
                    await Chat.findOne({
                        participantKey,
                    });

                if (existingChat) {
                    if (existingChat.deletedFor.includes(new mongoose.Types.ObjectId(currentUserId))) {
                        await Chat.updateOne(
                            { _id: existingChat._id },
                            { $pull: { deletedFor: currentUserId } }
                        );
                    }
                    res.status(200).json({
                        success: true,
                        chat: existingChat,
                    });

                    return;
                }
            }

            throw error;
        }
    }
);


export const getUserChats = asyncHandler(
    async (req, res) => {
        const currentUserId = req.user?.userId;

        if (!currentUserId) {
            throw new AppError("Unauthorized", 401);
        }

        // Get only chats this user participates in and hasn't deleted for themselves
        const chats = await Chat.find({
            participants: currentUserId,
            deletedFor: { $ne: currentUserId },
        })
            .sort({
                updatedAt: -1,
            })
            .populate({
                path: "participants",
                select: "username avatarUrl lastSeenAt name",
            })
            .populate({
                path: "lastMessage",
            });

        const chatIds = chats.map((chat) => chat._id);

        // Count unread messages only inside user's chats
        const unreadCounts = await getUnreadCountsForUser(
            currentUserId,
            chatIds
        );

        const chatsWithUnreadCount = await Promise.all(
            chats.map(async (chat) => {
                const otherParticipant = chat.participants.find(
                    (participant: any) =>
                        participant._id.toString() !== currentUserId
                );

                const blockStatus = otherParticipant
                    ? await getBlockDirection(
                        currentUserId,
                        otherParticipant._id.toString()
                    )
                    : { blockedByMe: false, blockedByThem: false };

                let lastMessage = chat.lastMessage;
                if (lastMessage && Array.isArray((lastMessage as any).deletedFor)) {
                    const isDeletedForUser = (lastMessage as any).deletedFor.some(
                        (id: any) => id.toString() === currentUserId
                    );
                    if (isDeletedForUser) {
                        lastMessage = null;
                    }
                }

                return {
                    ...chat.toObject(),
                    lastMessage,
                    unreadCount: unreadCounts.get(chat._id.toString()) ?? 0,
                    ...blockStatus,
                };
            })
        );

        res.status(200).json({
            success: true,
            chats: chatsWithUnreadCount,
        });
    }
);

export const deleteChatForMeHandler = asyncHandler(
    async (req, res) => {
        const currentUserId = req.user?.userId;
        const { chatId } = req.params;

        if (!currentUserId) {
            throw new AppError("Unauthorized", 401);
        }
        
        if (typeof chatId !== "string") {
            throw new AppError("Invalid chat ID", 400);
        }

        const chat = await deleteChatForMe(chatId, currentUserId);

        const io = req.app.get("io");
        io.to(`user:${currentUserId}`).emit("chat_deleted_for_me", { chatId });

        res.status(200).json({
            success: true,
            message: "Chat deleted for you",
        });
    }
);

export const deleteChatForEveryoneHandler = asyncHandler(
    async (req, res) => {
        const currentUserId = req.user?.userId;
        const { chatId } = req.params;

        if (!currentUserId) {
            throw new AppError("Unauthorized", 401);
        }
        
        if (typeof chatId !== "string") {
            throw new AppError("Invalid chat ID", 400);
        }

        const chat = await deleteChatForEveryone(chatId, currentUserId);

        const io = req.app.get("io");

        // Notify all participants
        for (const participantId of chat.participants) {
            io.to(`user:${participantId.toString()}`).emit("chat_deleted_for_everyone", { chatId });
        }

        res.status(200).json({
            success: true,
            message: "Chat deleted for everyone",
        });
    }
);