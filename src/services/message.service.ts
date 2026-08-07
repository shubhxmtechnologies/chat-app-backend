import { Chat } from "../models/chat.model.js";
import { Message } from "../models/message.model.js";
import { MessageType } from "../types/message.types.js";
import { AppError } from "../utils/appError.util.js";
import mongoose from "mongoose";
import { isBlockedEitherWay } from "./user.service.js";
import { deleteAsset } from "./cloudinary.service.js";

const DELETE_FOR_EVERYONE_WINDOW_MS =
    15 * 60 * 1000;
const MAX_BATCH_MESSAGES = 20;

interface BatchMessageInput {
    chatId: string;
    text: string;
    clientMessageId: string;
}


interface CreateMessageInput {
    chatId: string;
    senderId: string;

    messageType?: MessageType;

    text?: string;

    mediaUrl?: string;

    mediaPublicId?: string;
    clientMessageId?: string;
}
export const validateTextMessage = (
    text: string
): string => {
    if (typeof text !== "string") {
        throw new AppError(
            "Message must be text",
            400
        );
    }

    const normalized = text.trim();

    if (!normalized || normalized.length === 0) {
        throw new AppError(
            "Message cannot be empty",
            400
        );
    }

    if (normalized.length > 1000) {
        throw new AppError(
            "Message cannot exceed 1000 characters",
            400
        );
    }

    const words = normalized.split(/\s+/).filter(Boolean);
    if (words.length > 200) {
        throw new AppError(
            "Message cannot exceed 200 words",
            400
        );
    }

    return normalized;
};

export const createMessage = async ({
    chatId,
    senderId,
    messageType = "text",
    text,
    mediaUrl,
    mediaPublicId,
    clientMessageId
}: CreateMessageInput) => {
    if (!mongoose.isValidObjectId(chatId)) {
        throw new AppError(
            "Invalid chat ID",
            400
        );
    }

    if (messageType === "text") {
        if (typeof text !== "string") {
            throw new AppError("Message text is required", 400);
        }
        text = validateTextMessage(text);
    } else {
        if (!mediaUrl || !mediaPublicId) {
            throw new AppError(
                "Media upload failed",
                400
            );
        }

        text = undefined;
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

    const recipientId = chat.participants
        .find(
            (participantId) =>
                participantId.toString() !== senderId
        )
        ?.toString();

    if (!recipientId) {
        throw new AppError(
            "Recipient not found",
            500
        );
    }

    const blocked = await isBlockedEitherWay(
        senderId,
        recipientId
    );

    if (blocked) {
        throw new AppError(
            "You cannot send messages to this user",
            403
        );
    }

    if (clientMessageId) {
        const existingMessage =
            await Message.findOne({
                sender: senderId,
                chat: chatId,
                clientMessageId,
            });

        if (existingMessage) {
            return existingMessage;
        }
    }

    let message;

    try {
        message = await Message.create({
            chat: chatId,

            sender: senderId,

            clientMessageId:
                clientMessageId ?? null,

            messageType,

            text:
                messageType === "text"
                    ? (text ?? null)
                    : null,

            mediaUrl:
                messageType === "text"
                    ? null
                    : (mediaUrl ?? null),

            mediaPublicId:
                messageType === "text"
                    ? null
                    : (mediaPublicId ?? null),
        });
    } catch (error: unknown) {

        if (
            clientMessageId &&
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === 11000
        ) {

            const existingMessage =
                await Message.findOne({
                    sender: senderId,
                    chat: chatId,
                    clientMessageId,
                });

            if (existingMessage) {
                return existingMessage;
            }
        }

        throw error;
    }

    chat.lastMessage = message._id;
    
    if (chat.deletedFor && chat.deletedFor.length > 0) {
        chat.deletedFor = [];
    }

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
        deletedFor: { $ne: userId },
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
        deletedFor: { $ne: userId },
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

                deletedFor: {
                    $ne: new mongoose.Types.ObjectId(userId),
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

export const getAuthorizedMessage = async (
    messageId: string,
    userId: string
) => {
    if (!mongoose.isValidObjectId(messageId)) {
        throw new AppError(
            "Invalid message ID",
            400
        );
    }

    const message = await Message.findById(
        messageId
    );

    if (!message) {
        throw new AppError(
            "Message not found",
            404
        );
    }

    const chat = await Chat.findOne({
        _id: message.chat,
        participants: userId,
    });

    if (!chat) {
        throw new AppError(
            "Forbidden",
            403
        );
    }

    return {
        message,
        chat,
    };
};

export const editMessage = async (
    messageId: string,
    userId: string,
    text: string
) => {
    const { message, chat } =
        await getAuthorizedMessage(
            messageId,
            userId
        );

    if (
        message.sender.toString() !== userId
    ) {
        throw new AppError(
            "You can only edit your own messages",
            403
        );
    }

    if (message.messageType !== "text") {
        throw new AppError(
            "Only text messages can be edited",
            400
        );
    }

    if (
        message.isDeletedForEveryone
    ) {
        throw new AppError(
            "Message has been deleted",
            400
        );
    }

    message.text =
        validateTextMessage(text);

    message.isEdited = true;

    message.editedAt = new Date();

    await message.save();

    return {
        message,
        chat,
    };
};
export const deleteMessageForEveryone = async (
    messageId: string,
    userId: string
) => {
    const { message, chat } =
        await getAuthorizedMessage(
            messageId,
            userId
        );

    if (message.sender.toString() !== userId) {
        throw new AppError(
            "You can only delete your own messages",
            403
        );
    }

    if (message.isDeletedForEveryone) {
        throw new AppError(
            "Message already deleted",
            400
        );
    }

    const age =
        Date.now() -
        message.createdAt.getTime();

    if (
        age >
        DELETE_FOR_EVERYONE_WINDOW_MS
    ) {
        throw new AppError(
            "Delete for everyone is only available for 15 minutes",
            400
        );
    }

    /*
     * Remove uploaded media if present.
     */
    if (message.mediaPublicId) {
        try {
            await deleteAsset(
                message.mediaPublicId,
                message.messageType === "voice" ? "video" : "image"
            );
        } catch (error) {
            console.error("Failed to delete Cloudinary asset:", error);
        }
    }

    message.text = null;
    message.mediaUrl = null;
    message.mediaPublicId = null;
    message.isDeletedForEveryone = true;
    message.deletedAt = new Date();

    await message.save();

    return {
        message,
        chat,
    };
};
export const deleteMessageForMe = async (
    messageId: string,
    userId: string
) => {
    const { message } = await getAuthorizedMessage(
        messageId,
        userId
    );

    await Message.updateOne(
        { _id: message._id },
        { $addToSet: { deletedFor: userId } }
    );

    return message;
};
export const createMessageBatch = async (
    senderId: string,
    messages: BatchMessageInput[]
) => {

    if (messages.length > MAX_BATCH_MESSAGES) {
        throw new AppError(
            `Maximum ${MAX_BATCH_MESSAGES} messages per batch`,
            400
        );
    }

    const results = [];

    for (const item of messages) {
        try {
            const message = await createMessage({
                chatId: item.chatId,
                senderId,
                text: item.text,
                clientMessageId: item.clientMessageId,
            });

            results.push({
                clientMessageId: item.clientMessageId,
                success: true,
                message,
            });
        } catch (error) {
            results.push({
                clientMessageId: item.clientMessageId,
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to send message",
            });
        }
    }

    return results;
};