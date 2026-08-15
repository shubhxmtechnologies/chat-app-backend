import type { Server, Socket } from "socket.io";

import { Chat } from "../models/chat.model.js";
import { Message } from "../models/message.model.js";

import {
    createMessage,
} from "../services/message.service.js";

import { getUserRateLimits } from "./index.js";

import type { TokenPayload } from "../utils/jwt.util.js";
import { getAuthorizedChat } from "../services/chat.service.js";
import mongoose from "mongoose";
import { sendPushNotification } from "../services/push.service.js";
import { isUserOnline } from "./onlineUsers.js";
import { envConfig } from "../config/env.js";
import { User } from "../models/user.model.js";

interface SocketData {
    user: TokenPayload;
}

// M7: Per-user rate limiting that survives reconnections.
// Uses the server-level Map from socket/index.ts.
const isRateLimited = (
    userId: string,
    eventType: string,
    limit: number,
    windowMs: number
): boolean => {
    const allLimits = getUserRateLimits();
    if (!allLimits.has(userId)) {
        allLimits.set(userId, new Map());
    }
    const userLimits = allLimits.get(userId)!;
    if (!userLimits.has(eventType)) {
        userLimits.set(eventType, []);
    }
    const timestamps = userLimits.get(eventType)!;

    const now = Date.now();
    const cutoff = now - windowMs;

    while (
        timestamps.length > 0 &&
        timestamps[0]! <= cutoff
    ) {
        timestamps.shift();
    }

    if (timestamps.length >= limit) {
        return true;
    }

    timestamps.push(now);

    return false;
};

export const registerChatHandlers = (
    io: Server,
    socket: Socket<any, any, any, SocketData>
): void => {
    const userId = socket.data.user.userId;
    const joinedChats = new Set<string>();
    // JOIN CHAT
    socket.on("join_chat", async (chatId: string) => {
        if (
            isRateLimited(
                userId,
                "join",
                20,
                10_000
            )
        ) {
            return;
        }

        if (
            typeof chatId !== "string" ||
            !mongoose.isValidObjectId(chatId)
        ) {
            return;
        }

        try {
            await getAuthorizedChat(chatId, userId);
            await socket.join(chatId);
            joinedChats.add(chatId);
        } catch (error) {
            console.error(
                "join_chat error:",
                error
            );
        }
    });

    // LEAVE CHAT
    socket.on("leave_chat", (chatId: string) => {
        if (
            typeof chatId !== "string" ||
            !joinedChats.has(chatId)
        ) {
            return;
        }

        socket.leave(chatId);
        joinedChats.delete(chatId);
    });

    // SEND MESSAGE
    socket.on(
        "send_message",
        async (
            data: {
                chatId: string;
                text: string;
                clientMessageId?: string;
                replyTo?: string;
            },
            ack: (response: {
                success: boolean;
                message?: unknown;
                error?: string;
            }) => void
        ) => {
            if (
                isRateLimited(
                    userId,
                    "message",
                    60,
                    60_000
                )
            ) {
                ack({
                    success: false,
                    error: "You're sending messages too quickly.",
                });

                return;
            }

            if (
                !data ||
                typeof data !== "object" ||
                typeof data.chatId !== "string" ||
                typeof data.text !== "string"
            ) {
                ack({
                    success: false,
                    error: "Invalid message data",
                });

                return;
            }

            if (!mongoose.isValidObjectId(data.chatId)) {
                ack({
                    success: false,
                    error: "Invalid chat ID",
                });

                return;
            }

            try {
                const { chatId, text } = data;
                const senderId = socket.data.user.userId;

                // createMessage already checks that
                // sender belongs to this chat.
                const clientMessageId =
                    typeof data.clientMessageId === "string" &&
                        data.clientMessageId.length > 0 &&
                        data.clientMessageId.length <= 100
                        ? data.clientMessageId
                        : undefined;

                // M3: Validate replyTo as a proper ObjectId before passing to createMessage.
                const replyTo = data.replyTo && mongoose.isValidObjectId(data.replyTo)
                    ? data.replyTo : undefined;

                const message = await createMessage({
                    chatId,
                    senderId,
                    text,
                    ...(clientMessageId && { clientMessageId }),
                    ...(replyTo && { replyTo }),
                });

                const chat = await Chat.findById(chatId);

                if (!chat) {
                    ack({
                        success: false,
                        error: "Chat not found",
                    });

                    return;
                }

                const recipient = chat.participants.find(
                    (participant) =>
                        participant.toString() !== senderId
                );

                if (!recipient) {
                    ack({
                        success: false,
                        error: "Recipient not found",
                    });

                    return;
                }

                const recipientId = recipient.toString();

                /*
                 * Send through recipient's personal room.
                 *
                 * This works even when recipient is online
                 * but hasn't opened this specific chat.
                 */
                const isDeletedForRecipient = message.deletedFor.some(
                    (id) => id.toString() === recipientId
                );

                if (!isDeletedForRecipient) {
                    io.to(`user:${recipientId}`).emit(
                        "receive_message",
                        message
                    );
                    
                    if (!isUserOnline(recipientId, io)) {
                        const sender = await User.findById(senderId).select("username");
                        const senderName = sender?.username || "Someone";
                        sendPushNotification(recipientId, {
                            title: `New message from ${senderName}`,
                            body: text,
                            url: `${envConfig.CLIENT_ORIGIN}/chats/${chatId}`
                        }).catch(console.error);
                    }
                }

                io.to(`user:${senderId}`).emit("receive_message", message);
                ack({
                    success: true,
                    message,
                });
            } catch (error) {
                ack({
                    success: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : "Failed to send message",
                });
            }
        }
    );


    // MARK SEEN
    socket.on(
        "mark_seen",
        async (chatId: string) => {
            if (
                isRateLimited(
                    userId,
                    "seen",
                    20,
                    10_000
                )
            ) {
                return;
            }
            try {
                if (typeof chatId !== "string" || !mongoose.isValidObjectId(chatId)) {
                    return;
                }
                await getAuthorizedChat(
                    chatId,
                    userId
                );


                const unseenMessages = await Message.find({
                    chat: chatId,
                    sender: { $ne: userId },
                    status: { $ne: "seen" },
                });

                if (unseenMessages.length === 0) {
                    return;
                }

                const messageIds = unseenMessages.map(
                    (message) => message._id
                );

                const seenAt = new Date();
                await Message.updateMany(
                    {
                        _id: { $in: messageIds },
                        status: { $ne: "seen" },
                    },
                    {
                        $set: {
                            status: "seen",
                            seenAt,
                        },
                    }
                );

                const senderIds = new Set(
                    unseenMessages.map((message) =>
                        message.sender.toString()
                    )
                );

                for (const senderId of senderIds) {
                    io.to(`user:${senderId}`).emit("message_seen", {
                        chatId,
                        messageIds: messageIds.map((id) =>
                            id.toString()
                        ),
                        clientMessageIds: unseenMessages
                            .map((m) => m.clientMessageId)
                            .filter(Boolean),
                        seenAt,
                        markedBy: userId,
                    });
                }

                io.to(`user:${userId}`).emit("message_seen", {
                    chatId,
                    messageIds: messageIds.map((id) =>
                        id.toString()
                    ),
                    clientMessageIds: unseenMessages
                        .map((m) => m.clientMessageId)
                        .filter(Boolean),
                    seenAt,
                    markedBy: userId,
                });
            } catch (error) {
                console.error("mark_seen error:", error);
            }
        }
    );


    // TYPING
    socket.on("typing", (data: { chatId: string, recipientId: string }) => {
        if (!data || typeof data.chatId !== "string" || typeof data.recipientId !== "string") return;
        if (isRateLimited(userId, "typing", 10, 5_000)) return;
        if (!joinedChats.has(data.chatId)) return;

        socket.to(`user:${data.recipientId}`).emit("user_typing", {
            chatId: data.chatId,
            userId: socket.data.user.userId,
        });
    });


    // STOP TYPING
    socket.on("stop_typing", (data: { chatId: string, recipientId: string }) => {
        if (!data || typeof data.chatId !== "string" || typeof data.recipientId !== "string") return;
        if (!joinedChats.has(data.chatId)) return;

        socket.to(`user:${data.recipientId}`).emit("user_stop_typing", {
            chatId: data.chatId,
            userId: socket.data.user.userId,
        });
    });

    // CLEANUP on disconnect
    socket.on("disconnect", () => {
        for (const chatId of joinedChats) {
            socket.leave(chatId);
        }
        joinedChats.clear();
    });
};