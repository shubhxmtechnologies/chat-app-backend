import webpush from "web-push";
import https from "https";
import { envConfig } from "../config/env.js";
import { User } from "../models/user.model.js";

// Reusable HTTPS agent with keep-alive — avoids TLS handshake on every push
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 20 });

webpush.setVapidDetails(
    // The "mailto:" email is required by the Web Push protocol. It acts as a point of contact
    // for push service providers (like Google or Mozilla) if they need to reach the sender.
    // It is NEVER shown to the end users.
    "mailto:shubhxmtechnologies@gmail.com",
    envConfig.VAPID_PUBLIC_KEY,
    envConfig.VAPID_PRIVATE_KEY
);

/**
 * Web Push request options for maximum real-time delivery speed.
 * - urgency 'high': Tells FCM/Mozilla to deliver IMMEDIATELY (no batching, bypass idle queue)
 * - TTL 86400: Standard 24h message retention so notifications are not dropped when device is briefly asleep
 * - timeout 10000: Abort if push service doesn't respond in 10 seconds
 */
const PUSH_OPTIONS_CHAT: webpush.RequestOptions = {
    urgency: 'high',
    TTL: 86400,
    timeout: 10000,
    agent: keepAliveAgent,
    headers: {
        Urgency: 'high',
    },
};

const PUSH_OPTIONS_TEST: webpush.RequestOptions = {
    urgency: 'high',
    TTL: 300,
    timeout: 10000,
    agent: keepAliveAgent,
    headers: {
        Urgency: 'high',
    },
};

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
    const startTime = Date.now();
    try {
        const recipient = await User.findById(recipientId).select(
            "pushSubscription globalMute mutedChats blockedUsers"
        ).lean();

        const dbTime = Date.now() - startTime;

        if (!recipient || !recipient.pushSubscription) {
            console.log(`[PUSH] No active push subscription for recipient ${recipientId} (db: ${dbTime}ms)`);
            return;
        }

        // Verify recipient notification preferences
        if (recipient.globalMute) return;
        if (options.chatId && recipient.mutedChats?.some((id: any) => id.toString() === options.chatId)) return;
        if (options.senderId && recipient.blockedUsers?.some((id: any) => id.toString() === options.senderId)) return;

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
            tag: options.tag || `msg_${options.chatId || "chat"}_${Date.now()}`,
            renotify: true,
            badge: options.badge || "/badge-96x96.png",
            icon: options.icon || "/pwa-192x192.png",
            vibrate: [200, 100, 200]
        };

        const sub = recipient.pushSubscription as any;
        const endpoint = sub?.endpoint || "unknown";
        const pushService = endpoint.includes("fcm.googleapis.com") ? "FCM"
            : endpoint.includes("mozilla") ? "Mozilla"
            : endpoint.includes("windows") ? "WNS"
            : "PushService";

        console.log(`[PUSH] Dispatching to ${recipientId} via ${pushService} (db: ${dbTime}ms)`);

        // Real-time immediate dispatch with high urgency
        const pushStart = Date.now();
        await webpush.sendNotification(sub, JSON.stringify(payload), PUSH_OPTIONS_CHAT);
        const pushTime = Date.now() - pushStart;
        const totalTime = Date.now() - startTime;

        console.log(`[PUSH] ✅ Delivered to ${pushService} in ${pushTime}ms (total: ${totalTime}ms)`);
    } catch (error: any) {
        const totalTime = Date.now() - startTime;
        if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription expired or revoked, clean it up from database
            await User.findByIdAndUpdate(recipientId, { $set: { pushSubscription: null } });
            console.log(`[PUSH] 🗑️ Subscription expired for ${recipientId} (${totalTime}ms)`);
        } else {
            console.error(`[PUSH] ❌ Failed for ${recipientId} after ${totalTime}ms:`, error?.statusCode, error?.message || error);
        }
    }
};

/**
 * Send an immediate test notification to verify push delivery for a specific user
 */
export const sendTestPush = async (userId: string): Promise<void> => {
    const startTime = Date.now();
    const user = await User.findById(userId).select("pushSubscription").lean();
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
        badge: "/badge-96x96.png",
        icon: "/pwa-192x192.png",
        vibrate: [200, 100, 200]
    };

    try {
        const pushStart = Date.now();
        await webpush.sendNotification(user.pushSubscription as any, JSON.stringify(payload), PUSH_OPTIONS_TEST);
        console.log(`[PUSH-TEST] ✅ Delivered in ${Date.now() - pushStart}ms (total: ${Date.now() - startTime}ms)`);
    } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
            await User.findByIdAndUpdate(userId, { $set: { pushSubscription: null } });
            throw new Error("Subscription expired or uninstalled. Please toggle notifications off and on again.");
        }
        throw error;
    }
};