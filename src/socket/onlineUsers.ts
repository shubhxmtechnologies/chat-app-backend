import type { Server } from "socket.io";

const onlineUsers = new Map<string, Set<string>>();

export const setUserOnline = (
    userId: string,
    socketId: string,
    io?: Server
): boolean => {
    let sockets = onlineUsers.get(userId);

    if (sockets && io) {
        // Purge any dead socket IDs that are no longer in Socket.io's active connections
        for (const id of [...sockets]) {
            if (!io.sockets.sockets.has(id)) {
                sockets.delete(id);
            }
        }
    }

    const wasOffline = !sockets || sockets.size === 0;

    if (!sockets) {
        sockets = new Set<string>();
        onlineUsers.set(userId, sockets);
    }

    sockets.add(socketId);

    return wasOffline;
};

export const setUserOffline = (
    userId: string,
    socketId: string,
    io?: Server
): boolean => {
    const sockets = onlineUsers.get(userId);

    if (!sockets) {
        return false;
    }

    sockets.delete(socketId);

    if (io) {
        // Purge any dead socket IDs
        for (const id of [...sockets]) {
            if (!io.sockets.sockets.has(id)) {
                sockets.delete(id);
            }
        }
    }

    // User still has another active tab/device connected
    if (sockets.size > 0) {
        return false;
    }

    // No active connections left
    onlineUsers.delete(userId);

    return true;
};

export const isUserOnline = (
    userId: string,
    io?: Server
): boolean => {
    const sockets = onlineUsers.get(userId);
    if (!sockets || sockets.size === 0) return false;

    if (io) {
        for (const id of [...sockets]) {
            if (!io.sockets.sockets.has(id)) {
                sockets.delete(id);
            }
        }
        if (sockets.size === 0) {
            onlineUsers.delete(userId);
            return false;
        }
    }

    return sockets.size > 0;
};

export const getUserSocketIds = (
    userId: string
): string[] => {
    return [...(onlineUsers.get(userId) ?? [])];
};