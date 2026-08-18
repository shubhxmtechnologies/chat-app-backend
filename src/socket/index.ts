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
    clientIp: string;
}

// M7: Per-user rate limit tracking that survives socket reconnections.
// Maps userId -> event type -> array of timestamps.
const userRateLimits = new Map<string, Map<string, number[]>>();

// IP-based socket flood & connection pool tracking for DoS / DDoS mitigation
const activeSocketsByIp = new Map<string, Set<string>>();
const handshakeAttemptsByIp = new Map<string, number[]>();

const MAX_CONCURRENT_SOCKETS_PER_IP = 10;
const MAX_HANDSHAKES_PER_MIN_PER_IP = 30;

export const getUserRateLimits = () => userRateLimits;

export const cleanupUserRateLimits = (userId: string) => {
    userRateLimits.delete(userId);
};

// H3: Token re-validation interval (5 minutes)
const TOKEN_REVALIDATION_INTERVAL_MS = 5 * 60 * 1000;

let ioInstance: Server | null = null;
export const getIo = () => ioInstance;

const getClientIp = (handshake: any): string => {
    const forwarded = handshake?.headers?.["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded) {
        const first = forwarded.split(",")[0];
        if (first) return first.trim();
    }
    return handshake?.address || "127.0.0.1";
};

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
        connectTimeout: 10000,
        pingTimeout: 20000,
        pingInterval: 25000,
        // M5: Limit socket payload size to 10KB — sufficient for text chat messages.
        maxHttpBufferSize: 10 * 1024,
    });
    
    ioInstance = io;

    io.use((socket, next) => {
        try {
            const clientIp = getClientIp(socket.handshake);
            socket.data.clientIp = clientIp;

            // 1. Handshake Rate Limiting per IP (DoS defense)
            const now = Date.now();
            const recentAttempts = (handshakeAttemptsByIp.get(clientIp) || []).filter(
                (time) => now - time < 60000
            );

            if (recentAttempts.length >= MAX_HANDSHAKES_PER_MIN_PER_IP) {
                return next(new Error("Too many socket connection attempts. Please slow down."));
            }

            recentAttempts.push(now);
            handshakeAttemptsByIp.set(clientIp, recentAttempts);

            // 2. Active Concurrent Connection Limiting per IP (Connection Exhaustion defense)
            const currentSockets = activeSocketsByIp.get(clientIp) || new Set<string>();
            if (currentSockets.size >= MAX_CONCURRENT_SOCKETS_PER_IP) {
                return next(new Error("Too many active socket connections from this IP."));
            }

            // 3. JWT Authentication Check
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
        const clientIp = socket.data.clientIp;

        // Register active socket for IP connection pool
        const ipSockets = activeSocketsByIp.get(clientIp) || new Set<string>();
        ipSockets.add(socket.id);
        activeSocketsByIp.set(clientIp, ipSockets);

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

            // Clean up from active IP connection pool
            const socketsForIp = activeSocketsByIp.get(clientIp);
            if (socketsForIp) {
                socketsForIp.delete(socket.id);
                if (socketsForIp.size === 0) {
                    activeSocketsByIp.delete(clientIp);
                }
            }

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