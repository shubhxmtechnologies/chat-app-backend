import webpush from "web-push";
import { envConfig } from "../config/env.js";
import { User } from "../models/user.model.js";

webpush.setVapidDetails(
    // The "mailto:" email is required by the Web Push protocol. It acts as a point of contact
    // for push service providers (like Google or Mozilla) if they need to reach the sender.
    // It is NEVER shown to the end users.
    "mailto:shubhxmtechnologies@gmail.com",
    envConfig.VAPID_PUBLIC_KEY,
    envConfig.VAPID_PRIVATE_KEY
);

export interface PushNotificationOptions {
    title?: string;
    body: string;
    url: string;
    chatId?: string;
    senderId?: string;
    senderName?: string;
    tag?: string;
    badge?: string;
    icon?: string;
    isTest?: boolean;
}

/**
 * Send real-time Web Push notification immediately to a recipient.
 * Artificial delays, burst throttles, and spam debounce queues have been removed
 * so notifications are delivered to the recipient in 0ms real time.
 */
export const sendPushNotification = async (
    recipientId: string,
    options: PushNotificationOptions
): Promise<void> => {
    try {
        const recipient = await User.findById(recipientId);
        if (!recipient || !recipient.pushSubscription) return;

        // Verify recipient notification preferences
        if (recipient.globalMute) return;
        if (options.chatId && recipient.mutedChats?.some((id) => id.toString() === options.chatId)) return;
        if (options.senderId && recipient.blockedUsers?.some((id) => id.toString() === options.senderId)) return;

        const senderName = options.senderName || "Someone";
        const title = options.title || `New message from ${senderName}`;

        const payload = {
            title,
            body: options.body,
            url: options.url,
            chatId: options.chatId,
            senderId: options.senderId,
            senderName,
            isTest: !!options.isTest,
            tag: options.tag || (options.chatId ? `chat_${options.chatId}` : undefined),
            renotify: true,
            badge: options.badge || "/pwa-192x192.png",
            icon: options.icon || "/pwa-192x192.png",
            vibrate: [200, 100, 200]
        };

        // Real-time immediate dispatch (no delay, no pending timer)
        await webpush.sendNotification(recipient.pushSubscription, JSON.stringify(payload));
    } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription expired or revoked, clean it up from database
            await User.findByIdAndUpdate(recipientId, { $set: { pushSubscription: null } });
        } else {
            console.error("Push notification delivery failed:", error?.message || error);
        }
    }
};

/**
 * Send an immediate test notification to verify push delivery for a specific user
 */
export const sendTestPush = async (userId: string): Promise<void> => {
    const user = await User.findById(userId);
    if (!user || !user.pushSubscription) {
        throw new Error("No active push subscription found. Please enable notifications first.");
    }

    const payload = {
        title: "Pinsta Notification Test",
        body: "Real-time notifications are working! You'll receive message alerts instantly. 🚀",
        url: "/profile",
        isTest: true,
        tag: `test_${Date.now()}`,
        renotify: true,
        badge: "/pwa-192x192.png",
        icon: "/pwa-192x192.png",
        vibrate: [200, 100, 200]
    };

    try {
        await webpush.sendNotification(user.pushSubscription, JSON.stringify(payload));
    } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
            await User.findByIdAndUpdate(userId, { $set: { pushSubscription: null } });
            throw new Error("Subscription expired or uninstalled. Please toggle notifications off and on again.");
        }
        throw error;
    }
};