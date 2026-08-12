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

// M7: Per-user rate limit tracking that survives socket reconnections.
// Maps userId -> event type -> array of timestamps.
const userRateLimits = new Map<string, Map<string, number[]>>();

export const getUserRateLimits = () => userRateLimits;

export const cleanupUserRateLimits = (userId: string) => {
    userRateLimits.delete(userId);
};

// H3: Token re-validation interval (5 minutes)
const TOKEN_REVALIDATION_INTERVAL_MS = 5 * 60 * 1000;

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
        // M5: Limit socket payload size to 10KB — sufficient for text chat messages.
        maxHttpBufferSize: 10 * 1024,
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
            socket.id,
            io
        );

        await socket.join(`user:${userId}`);

        // H3: Periodic token re-validation — disconnect if JWT is expired.
        const revalidationInterval = setInterval(() => {
            try {
                const token = socket.handshake.auth?.token;
                if (typeof token !== "string" || !token) {
                    socket.emit("auth_error", { message: "Session expired" });
                    socket.disconnect(true);
                    return;
                }
                verifyAccessToken(token);
            } catch {
                socket.emit("auth_error", { message: "Session expired" });
                socket.disconnect(true);
            }
        }, TOKEN_REVALIDATION_INTERVAL_MS);

        // Fetch contacts and send presence updates
        const contactIds = await getContactIds(userId);
        const currentlyOnlineContacts: string[] = [];

        for (const contactId of contactIds) {
            if (isUserOnline(contactId.toString(), io)) {
                currentlyOnlineContacts.push(contactId.toString());
            }

            // Broadcast to all online contacts that this user is online
            io.to(`user:${contactId}`).emit("user_online", {
                userId,
            });
        }

        // Always emit the authoritative list of online contacts to the newly connected user
        socket.emit("initial_online_users", currentlyOnlineContacts);

        // Allow client to re-request the online users list on reconnection
        socket.on("get_online_users", async () => {
            try {
                const contacts = await getContactIds(userId);
                const onlineList = contacts.filter((id) => isUserOnline(id.toString(), io));
                socket.emit("initial_online_users", onlineList);
            } catch (err) {
                console.error("Failed to fetch online users for socket:", err);
            }
        });

        // Allow client to update auth token on silent refresh without disconnecting
        socket.on("update_auth_token", (newToken: string) => {
            try {
                if (typeof newToken === "string" && newToken) {
                    const decoded = verifyAccessToken(newToken);
                    if (decoded.userId === userId) {
                        if (!socket.handshake.auth) {
                            socket.handshake.auth = {};
                        }
                        socket.handshake.auth.token = newToken;
                        socket.data.user = decoded;
                    }
                }
            } catch (err) {
                console.warn("Failed to update socket auth token:", err);
            }
        });

        registerChatHandlers(io, socket);

        socket.on("disconnect", async () => {
            // H3: Clear re-validation interval on disconnect
            clearInterval(revalidationInterval);

            const becameOffline = setUserOffline(
                userId,
                socket.id,
                io
            );

            if (!becameOffline) {
                return;
            }

            // M7: Clean up per-user rate limits when user fully disconnects
            cleanupUserRateLimits(userId);

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

            // Notify contacts that user went offline
            const contacts = await getContactIds(userId);

            for (const contactId of contacts) {
                io.to(`user:${contactId}`).emit("user_offline", {
                    userId,
                    lastSeenAt: lastSeenAt.toISOString(),
                });
            }
        });
    });

    return io;
};