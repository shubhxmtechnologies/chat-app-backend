import mongoose from "mongoose";

import { Chat } from "../models/chat.model.js";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/appError.util.js";
import { Message } from "../models/message.model.js";
import { deleteAsset } from "./cloudinary.service.js";

export const getAuthorizedChat = async (
    chatId: string,
    userId: string
) => {
    if (!mongoose.isValidObjectId(chatId)) {
        throw new AppError("Invalid chat ID", 400);
    }

    const chat = await Chat.findOne({
        _id: chatId,
        participants: userId,
    });

    if (!chat) {
        throw new AppError("Chat not found", 404);
    }

    return chat;
};

export const getContactIds = async (
    userId: string
): Promise<string[]> => {
    const [userChats, currentUser] = await Promise.all([
        Chat.find({
            participants: userId,
        }).select("participants"),
        User.findById(userId).select("blockedUsers").lean(),
    ]);

    const blockedSet = new Set(
        (currentUser?.blockedUsers ?? []).map((id) => id.toString())
    );

    const contactIds = new Set<string>();

    for (const chat of userChats) {
        for (const participantId of chat.participants) {
            const id = participantId.toString();

            if (id !== userId && !blockedSet.has(id)) {
                contactIds.add(id);
            }
        }
    }

    return [...contactIds];
};

export const deleteChatForMe = async (
    chatId: string,
    userId: string
) => {
    const chat = await getAuthorizedChat(chatId, userId);

    // Mark all messages as deleted for this user
    await Message.updateMany(
        { chat: chatId },
        { $addToSet: { deletedFor: userId } }
    );

    // Add user to chat's deletedFor array
    await Chat.updateOne(
        { _id: chatId },
        { $addToSet: { deletedFor: userId } }
    );

    return chat;
};

export const deleteChatForEveryone = async (
    chatId: string,
    userId: string
) => {
    const chat = await getAuthorizedChat(chatId, userId);

    // Get all media messages
    const mediaMessages = await Message.find({
        chat: chatId,
        mediaPublicId: { $ne: null }
    }).select("mediaPublicId messageType");

    // Delete media from Cloudinary
    for (const msg of mediaMessages) {
        if (msg.mediaPublicId) {
            try {
                await deleteAsset(
                    msg.mediaPublicId,
                    msg.messageType === "voice" ? "video" : "image"
                );
            } catch (err) {
                console.error("Failed to delete media asset for chat deletion:", err);
            }
        }
    }

    // Delete all messages
    await Message.deleteMany({ chat: chatId });

    // Delete chat document
    await Chat.deleteOne({ _id: chatId });

    return chat;
};