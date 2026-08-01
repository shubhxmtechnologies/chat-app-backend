import type { Server as HttpServer } from "http";
import { Server } from "socket.io";

import { envConfig } from "../config/env.js";
import { User } from "../models/user.model.js";

import {
    verifyAccessToken,
    type TokenPayload,
} from "../utils/jwt.util.js";

import {
    markPendingAsDelivered,
} from "../services/message.service.js";

import { registerChatHandlers } from "./chat.socket.js";

import {
    setUserOnline,
    setUserOffline,
} from "./onlineUsers.js";
import { Chat } from "../models/chat.model.js";

interface SocketData {
    user: TokenPayload;
}

export const setupSocket = (httpServer: HttpServer): Server => {
    const io = new Server<
        Record<string, never>,
        Record<string, never>,
        Record<string, never>,
        SocketData
    >(httpServer, {
        cors: {
            origin: envConfig.CLIENT_ORIGIN,
            credentials: true,
        },
    });

    // Socket authentication
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;

            if (typeof token !== "string" || !token) {
                return next(new Error("Unauthorized"));
            }

            const decoded = verifyAccessToken(token);

            socket.data.user = decoded;

            next();
        } catch {
            next(new Error("Unauthorized"));
        }
    });

    io.on("connection", async (socket) => {
        const userId = socket.data.user.userId;

        // Add this socket to user's active sockets
        const becameOnline = setUserOnline(
            userId,
            socket.id
        );

        // Personal room
        await socket.join(`user:${userId}`);

        // Only broadcast when user goes 0 → 1 sockets
        if (becameOnline) {
            socket.broadcast.emit("user_online", {
                userId,
            });
        }
        const userChats = await Chat.find({ participants: userId }).select("participants");
        const contactIds = new Set<string>();
        for (const chat of userChats) {
            for (const participantId of chat.participants) {
                const id = participantId.toString();
                if (id !== userId) contactIds.add(id);
            }
        }
        for (const contactId of contactIds) {
            io.to(`user:${contactId}`).emit("user_online", { userId });
        }
        // Mark messages sent while user was offline as delivered
        try {
            const pendingMessages =
                await markPendingAsDelivered(userId);

            for (const {
                message,
                deliveredAt,
            } of pendingMessages) {
                io.to(
                    `user:${message.sender.toString()}`
                ).emit("message_delivered", {
                    messageId: message._id.toString(),
                    deliveredAt,
                });
            }
        } catch (error) {
            console.error(
                "Pending delivery update failed:",
                error
            );
        }

        registerChatHandlers(io, socket);

        socket.on("disconnect", async () => {
            const becameOffline = setUserOffline(
                userId,
                socket.id
            );

            // Another tab/device remains connected
            if (!becameOffline) {
                return;
            }

            const lastSeenAt = new Date();

            try {
                await User.findByIdAndUpdate(userId, {
                    $set: {
                        lastSeenAt,
                    },
                });

            } catch (error) {
                console.error(
                    "Failed to update last seen:",
                    error
                );
            }

            // Only broadcast when user goes 1 → 0 sockets
            socket.broadcast.emit("user_offline", {
                userId,
                lastSeenAt,
            });
        });
    });

    return io;
};