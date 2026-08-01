import type { Server, Socket } from "socket.io";

import { Chat } from "../models/chat.model.js";
import { Message } from "../models/message.model.js";

import {
    createMessage,
} from "../services/message.service.js";

import { isUserOnline } from "./onlineUsers.js";

import type { TokenPayload } from "../utils/jwt.util.js";
import { getAuthorizedChat } from "../services/chat.service.js";
import mongoose from "mongoose";

interface SocketData {
    user: TokenPayload;
}

const isRateLimited = (
    timestamps: number[],
    limit: number,
    windowMs: number
): boolean => {
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
    const messageTimestamps: number[] = [];
    const typingTimestamps: number[] = [];
    const joinTimestamps: number[] = [];
    const seenTimestamps: number[] = [];
    const joinedChats = new Set<string>();
    // JOIN CHAT
    socket.on("join_chat", async (chatId: string) => {
        if (
            isRateLimited(
                joinTimestamps,
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
            const userId = socket.data.user.userId;

            // DB authorization happens once here.
            await getAuthorizedChat(
                chatId,
                userId
            );

            await socket.join(chatId);

            // Remember that THIS socket was authorized.
            joinedChats.add(chatId);
        } catch (error) {
            console.error(
                "join_chat error:",
                error
            );
        }
    });


    // SEND MESSAGE
    socket.on(
        "send_message",
        async (
            data: {
                chatId: string;
                text: string;
            },
            ack: (response: {
                success: boolean;
                message?: unknown;
                error?: string;
            }) => void
        ) => {
            if (
                isRateLimited(
                    messageTimestamps,
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
                const message = await createMessage(
                    {
                        chatId,
                        senderId,
                        text
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
                io.to(`user:${recipientId}`).emit(
                    "receive_message",
                    message
                );

                /*
                 * Recipient has at least one connected socket.
                 */
                if (isUserOnline(recipientId)) {
                    const deliveredAt = new Date();

                    await Message.updateOne(
                        {
                            _id: message._id,
                            status: "sent",
                        },
                        {
                            $set: {
                                status: "delivered",
                                deliveredAt,
                            },
                        }
                    );

                    /*
                     * Tell ALL sender devices/tabs,
                     * not only the socket that sent it.
                     */
                    io.to(`user:${senderId}`).emit(
                        "message_delivered",
                        {
                            messageId:
                                message._id.toString(),
                            deliveredAt,
                        }
                    );
                }

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
                    seenTimestamps,
                    20,
                    10_000
                )
            ) {
                return;
            }
            try {
                const userId = socket.data.user.userId;

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
                    [
                        {
                            $set: {
                                status: "seen",

                                seenAt,

                                deliveredAt: {
                                    $ifNull: [
                                        "$deliveredAt",
                                        seenAt,
                                    ],
                                },
                            },
                        },
                    ]
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
                        seenAt,
                    });
                }
            } catch (error) {
                console.error("mark_seen error:", error);
            }
        }
    );


    // TYPING
    socket.on("typing", (chatId: string) => {
        if (
            isRateLimited(
                typingTimestamps,
                10,
                5_000
            )
        ) {
            return;
        }

        if (
            typeof chatId !== "string" ||
            !joinedChats.has(chatId)
        ) {
            return;
        }

        socket.to(chatId).emit("user_typing", {
            chatId,
            userId: socket.data.user.userId,
        });
    });


    // STOP TYPING
    socket.on("stop_typing", (chatId: string) => {
        if (
            typeof chatId !== "string" ||
            !joinedChats.has(chatId)
        ) {
            return;
        }

        socket
            .to(chatId)
            .emit("user_stop_typing", {
                chatId,
                userId: socket.data.user.userId,
            });
    });
};