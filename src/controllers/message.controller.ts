import { getChatMessages } from "../services/message.service.js";
import { Message } from "../models/message.model.js";
import { createMessage } from "../services/message.service.js";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import { AppError } from "../utils/appError.util.js";

export const sendMessage = asyncHandler(async (req, res) => {
    const senderId = req.user?.userId;
    const { chatId, text } = req.body;

    if (!senderId) {
        throw new AppError("Unauthorized", 401);
    }

    const message = await createMessage(
        chatId,
        senderId,
        text
    );

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