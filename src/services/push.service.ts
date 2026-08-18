import webpush from "web-push";
import { envConfig } from "../config/env.js";
import { User } from "../models/user.model.js";

webpush.setVapidDetails(
    // The "mailto:" email is required by the Web Push protocol. It acts as a point of contact
    // for push service providers (like Google or Mozilla) if they need to reach the sender.
    // It is NEVER shown to the end users. It can be any email you monitor.
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
}

interface PendingPush {
    timer: NodeJS.Timeout;
    count: number;
    latestBody: string;
    recipientId: string;
    options: PushNotificationOptions;
}

// In-memory queue to debounce and aggregate rapid-fire messages per (recipient, chat)
const pendingPushQueue = new Map<string, PendingPush>();

const DEBOUNCE_WINDOW_MS = 1500;

const executePushSend = async (recipientId: string, options: PushNotificationOptions, count: number, latestBody: string) => {
    try {
        const recipient = await User.findById(recipientId);
        if (!recipient || !recipient.pushSubscription) return;

        // Verify recipient notification preferences
        if (recipient.globalMute) return;
        if (options.chatId && recipient.mutedChats?.some((id) => id.toString() === options.chatId)) return;
        if (options.senderId && recipient.blockedUsers?.some((id) => id.toString() === options.senderId)) return;

        const senderName = options.senderName || "Someone";
        const title = count > 1
            ? `${senderName} (${count} new messages)`
            : (options.title || `New message from ${senderName}`);

        const payload = {
            title,
            body: latestBody,
            url: options.url,
            chatId: options.chatId,
            senderId: options.senderId,
            senderName,
            count,
            tag: options.tag || (options.chatId ? `chat_${options.chatId}` : undefined),
            renotify: true,
            badge: options.badge || "/favicon.svg",
            icon: options.icon || "/favicon.svg",
            vibrate: [200, 100, 200]
        };

        await webpush.sendNotification(recipient.pushSubscription, JSON.stringify(payload));
    } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription expired or revoked, clean it up
            await User.findByIdAndUpdate(recipientId, { $set: { pushSubscription: null } });
        } else {
            console.error("Push notification failed:", error);
        }
    }
};

export const sendPushNotification = async (
    recipientId: string,
    options: PushNotificationOptions
) => {
    try {
        const queueKey = `${recipientId}:${options.chatId || "general"}`;
        const existing = pendingPushQueue.get(queueKey);

        if (existing) {
            clearTimeout(existing.timer);
            const newCount = existing.count + 1;
            const newLatestBody = options.body;

            existing.count = newCount;
            existing.latestBody = newLatestBody;
            existing.options = options;
            existing.timer = setTimeout(async () => {
                pendingPushQueue.delete(queueKey);
                await executePushSend(recipientId, options, newCount, newLatestBody);
            }, DEBOUNCE_WINDOW_MS);
        } else {
            const pending: PendingPush = {
                timer: setTimeout(async () => {
                    pendingPushQueue.delete(queueKey);
                    await executePushSend(recipientId, options, 1, options.body);
                }, DEBOUNCE_WINDOW_MS),
                count: 1,
                latestBody: options.body,
                recipientId,
                options
            };
            pendingPushQueue.set(queueKey, pending);
        }
    } catch (err) {
        console.error("Error scheduling push notification:", err);
    }
};