const onlineUsers = new Map<string, Set<string>>();

export const setUserOnline = (
    userId: string,
    socketId: string
): boolean => {
    let sockets = onlineUsers.get(userId);

    // First active connection for this user
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
    socketId: string
): boolean => {
    const sockets = onlineUsers.get(userId);

    if (!sockets) {
        return false;
    }

    sockets.delete(socketId);

    // User still has another tab/device connected
    if (sockets.size > 0) {
        return false;
    }

    // No connections left
    onlineUsers.delete(userId);

    return true;
};

export const isUserOnline = (
    userId: string
): boolean => {
    return (onlineUsers.get(userId)?.size ?? 0) > 0;
};

export const getUserSocketIds = (
    userId: string
): string[] => {
    return [...(onlineUsers.get(userId) ?? [])];
};