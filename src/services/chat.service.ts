import mongoose from "mongoose";

import { Chat } from "../models/chat.model.js";
import { AppError } from "../utils/appError.util.js";

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