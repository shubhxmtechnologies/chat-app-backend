import type { Server as HttpServer } from "http";
import { Server } from "socket.io";

import { envConfig } from "../config/env.js";
import { User } from "../models/user.model.js";

import {
    verifyAccessToken,
    type TokenPayload,
} from "../utils/jwt.util.js";

import {
} from "../services/message.service.js";

import { registerChatHandlers } from "./chat.socket.js";

import {
    setUserOnline,
    setUserOffline,
    isUserOnline
} from "./onlineUsers.js";

import { getContactIds } from "../services/chat.service.js";

interface SocketData {
    user: TokenPayload;
}

export const setupSocket = (httpServer: HttpServer): Server => {
    const io = new Server<
        any,
        any,
        any,
        SocketData
    >(httpServer, {
        cors: {
            origin: envConfig.CLIENT_ORIGIN,
            credentials: true,
        },
    });

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

        const becameOnline = setUserOnline(
            userId,
            socket.id
        );

        await socket.join(`user:${userId}`);

        // Only notify contacts when user goes 0 → 1 sockets
        if (becameOnline) {
            const contactIds = await getContactIds(userId);

            const currentlyOnlineContacts: string[] = [];

            for (const contactId of contactIds) {
                if (isUserOnline(contactId.toString())) {
                    currentlyOnlineContacts.push(contactId.toString());
                }

                io.to(`user:${contactId}`).emit("user_online", {
                    userId,
                });
            }

            if (currentlyOnlineContacts.length > 0) {
                socket.emit("initial_online_users", currentlyOnlineContacts);
            }
        } else {
            // Even if they are already online on another device, send them their online contacts for this new connection
            const contactIds = await getContactIds(userId);
            const currentlyOnlineContacts: string[] = [];
            for (const contactId of contactIds) {
                if (isUserOnline(contactId.toString())) {
                    currentlyOnlineContacts.push(contactId.toString());
                }
            }
            if (currentlyOnlineContacts.length > 0) {
                socket.emit("initial_online_users", currentlyOnlineContacts);
            }
        }



        registerChatHandlers(io, socket);

        socket.on("disconnect", async () => {
            const becameOffline = setUserOffline(
                userId,
                socket.id
            );

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

            // Only notify contacts when user goes 1 → 0 sockets
            const contactIds = await getContactIds(userId);

            for (const contactId of contactIds) {
                io.to(`user:${contactId}`).emit("user_offline", {
                    userId,
                    lastSeenAt,
                });
            }
        });
    });

    return io;
};