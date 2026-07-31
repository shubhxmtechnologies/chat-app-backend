import { Chat } from "../models/chat.model.js";
import { Message } from "../models/message.model.js";
import { AppError } from "../utils/appError.util.js";
import mongoose from "mongoose";

export const createMessage = async (
    chatId: string,
    senderId: string,
    text: string
) => {
    if (!mongoose.isValidObjectId(chatId)) {
        throw new AppError(
            "Invalid chat ID",
            400
        );
    }

    if (typeof text !== "string") {
        throw new AppError(
            "Message must be text",
            400
        );
    }
    const normalizedText = text.trim();

    if (!normalizedText) {
        throw new AppError(
            "Message cannot be empty",
            400
        );
    }

    if (normalizedText.length > 5000) {
        throw new AppError(
            "Message is too long",
            400
        );
    }
    const chat = await Chat.findById(chatId);

    if (!chat) {
        throw new AppError("Chat not found", 404);
    }

    const isParticipant = chat.participants.some(
        (participantId) => participantId.toString() === senderId
    );

    if (!isParticipant) {
        throw new AppError("You are not a participant of this chat", 403);
    }

    const message = await Message.create({
        chat: chatId,
        sender: senderId,
        text: normalizedText,
    });

    chat.lastMessage = message._id;

    await chat.save();

    return message;
};

export const markPendingAsDelivered = async (
    recipientId: string
) => {
    if (!mongoose.isValidObjectId(recipientId)) {
        throw new AppError(
            "Invalid recipient ID",
            400
        );
    }

    const userChats = await Chat.find({
        participants: recipientId,
    })
        .select("_id")
        .lean();

    if (userChats.length === 0) {
        return [];
    }

    const chatIds = userChats.map(
        (chat) => chat._id
    );

    const pendingMessages = await Message.find({
        chat: {
            $in: chatIds,
        },
        sender: {
            $ne: new mongoose.Types.ObjectId(
                recipientId
            ),
        },
        status: "sent",
    });

    if (pendingMessages.length === 0) {
        return [];
    }

    const messageIds = pendingMessages.map(
        (message) => message._id
    );

    const deliveredAt = new Date();

    await Message.updateMany(
        {
            _id: {
                $in: messageIds,
            },
            status: "sent",
        },
        {
            $set: {
                status: "delivered",
                deliveredAt,
            },
        }
    );

    return pendingMessages.map((message) => ({
        message,
        deliveredAt,
    }));
};


export const getUnreadCount = async (
    chatId: string,
    userId: string
): Promise<number> => {
    return Message.countDocuments({
        chat: chatId,
        sender: { $ne: userId },
        status: { $ne: "seen" },
    });
};


const MESSAGE_PAGE_SIZE = 30;

export const getChatMessages = async (
    chatId: string,
    userId: string,
    before?: string
) => {
    if (!mongoose.isValidObjectId(chatId)) {
        throw new AppError(
            "Invalid chat ID",
            400
        );
    }
    if (!mongoose.isValidObjectId(userId)) {
        throw new AppError("Unauthorized", 401);
    }
    const chat = await Chat.findOne({
        _id: chatId,
        participants: userId,
    });
    if (!chat) {
        throw new AppError("Chat not found", 404);
    }
    const filter: Record<string, unknown> = {
        chat: chatId,
    };

    if (before) {
        let cursor: {
            createdAt: string;
            id: string;
        };

        try {
            cursor = JSON.parse(
                Buffer.from(before, "base64url").toString("utf8")
            );
        } catch {
            throw new AppError("Invalid message cursor", 400);
        }

        const cursorDate = new Date(cursor.createdAt);

        if (
            Number.isNaN(cursorDate.getTime()) ||
            !mongoose.isValidObjectId(cursor.id)
        ) {
            throw new AppError("Invalid message cursor", 400);
        }

        filter.$or = [
            {
                createdAt: {
                    $lt: cursorDate,
                },
            },
            {
                createdAt: cursorDate,
                _id: {
                    $lt: new mongoose.Types.ObjectId(cursor.id),
                },
            },
        ];
    }

    const messages = await Message.find(filter)
        .sort({
            createdAt: -1,
            _id: -1,
        })
        .limit(MESSAGE_PAGE_SIZE);

    const oldestMessage = messages.at(-1);

    const nextCursor =
        messages.length === MESSAGE_PAGE_SIZE && oldestMessage
            ? Buffer.from(
                JSON.stringify({
                    createdAt: oldestMessage.createdAt.toISOString(),
                    id: oldestMessage._id.toString(),
                })
            ).toString("base64url")
            : null;

    return {
        messages,
        nextCursor,
    };
};

export const getUnreadCountsForUser = async (
    userId: string,
    chatIds: mongoose.Types.ObjectId[]
): Promise<Map<string, number>> => {

    if (chatIds.length === 0) {
        return new Map();
    }

    const counts = await Message.aggregate<{
        _id: mongoose.Types.ObjectId;
        count: number;
    }>([
        {
            $match: {
                chat: {
                    $in: chatIds,
                },

                sender: {
                    $ne: new mongoose.Types.ObjectId(userId),
                },

                status: {
                    $ne: "seen",
                },
            },
        },

        {
            $group: {
                _id: "$chat",

                count: {
                    $sum: 1,
                },
            },
        },
    ]);

    return new Map(
        counts.map(({ _id, count }) => [
            _id.toString(),
            count,
        ])
    );
};