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
            "pushSubscription pushSubscriptions globalMute mutedChats blockedUsers"
        ).lean();

        const dbTime = Date.now() - startTime;

        if (!recipient) return;

        // Collect all active subscriptions (multi-device + legacy fallback)
        const subs: any[] = [];
        const seenEndpoints = new Set<string>();

        if ((recipient as any).pushSubscriptions?.length) {
            for (const s of (recipient as any).pushSubscriptions) {
                if (s?.endpoint && !seenEndpoints.has(s.endpoint)) {
                    seenEndpoints.add(s.endpoint);
                    subs.push(s);
                }
            }
        }
        if (recipient.pushSubscription && typeof recipient.pushSubscription === "object") {
            const legacySub = recipient.pushSubscription as any;
            if (legacySub.endpoint && !seenEndpoints.has(legacySub.endpoint)) {
                seenEndpoints.add(legacySub.endpoint);
                subs.push(legacySub);
            }
        }

        if (subs.length === 0) {
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

        const payloadStr = JSON.stringify(payload);

        // Dispatch in parallel to all registered devices of this recipient
        const dispatchPromises = subs.map(async (sub) => {
            const endpoint = sub.endpoint || "unknown";
            const pushService = endpoint.includes("fcm.googleapis.com") ? "FCM"
                : endpoint.includes("mozilla") ? "Mozilla"
                : endpoint.includes("windows") ? "WNS"
                : "PushService";

            const pushStart = Date.now();
            try {
                await webpush.sendNotification(sub, payloadStr, PUSH_OPTIONS_CHAT);
                const pushTime = Date.now() - pushStart;
                console.log(`[PUSH] ✅ Delivered to ${pushService} in ${pushTime}ms`);
            } catch (error: any) {
                const pushTime = Date.now() - pushStart;
                if (error.statusCode === 410 || error.statusCode === 404) {
                    // Remove ONLY this expired device endpoint, preserving other devices
                    console.log(`[PUSH] 🗑️ Subscription expired (410) for ${recipientId} endpoint ${endpoint.substring(0, 45)}...`);
                    await User.findByIdAndUpdate(recipientId, {
                        $pull: { pushSubscriptions: { endpoint: sub.endpoint } }
                    });
                    if ((recipient.pushSubscription as any)?.endpoint === sub.endpoint) {
                        await User.findByIdAndUpdate(recipientId, { $set: { pushSubscription: null } });
                    }
                } else {
                    console.error(`[PUSH] ❌ Failed to ${pushService} after ${pushTime}ms:`, error?.statusCode, error?.message || error);
                }
            }
        });

        await Promise.allSettled(dispatchPromises);
    } catch (error: any) {
        console.error(`[PUSH] Global failure for ${recipientId}:`, error?.message || error);
    }
};

/**
 * Send an immediate test notification to verify push delivery for a specific user
 */
export const sendTestPush = async (userId: string): Promise<{ success: boolean; deliveredCount: number }> => {
    const startTime = Date.now();
    const user = await User.findById(userId).select("pushSubscription pushSubscriptions").lean();
    if (!user) {
        throw new Error("User not found.");
    }

    const subs: any[] = [];
    const seenEndpoints = new Set<string>();

    if ((user as any).pushSubscriptions?.length) {
        for (const s of (user as any).pushSubscriptions) {
            if (s?.endpoint && !seenEndpoints.has(s.endpoint)) {
                seenEndpoints.add(s.endpoint);
                subs.push(s);
            }
        }
    }
    if (user.pushSubscription && typeof user.pushSubscription === "object") {
        const legacySub = user.pushSubscription as any;
        if (legacySub.endpoint && !seenEndpoints.has(legacySub.endpoint)) {
            seenEndpoints.add(legacySub.endpoint);
            subs.push(legacySub);
        }
    }

    if (subs.length === 0) {
        throw new Error("No active push subscription found. Please click 'Enable Push' first.");
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

    const payloadStr = JSON.stringify(payload);
    let deliveredCount = 0;

    const testPromises = subs.map(async (sub) => {
        try {
            await webpush.sendNotification(sub, payloadStr, PUSH_OPTIONS_TEST);
            deliveredCount++;
        } catch (error: any) {
            if (error.statusCode === 410 || error.statusCode === 404) {
                await User.findByIdAndUpdate(userId, {
                    $pull: { pushSubscriptions: { endpoint: sub.endpoint } }
                });
                if ((user.pushSubscription as any)?.endpoint === sub.endpoint) {
                    await User.findByIdAndUpdate(userId, { $set: { pushSubscription: null } });
                }
            }
            throw error;
        }
    });

    const results = await Promise.allSettled(testPromises);
    const hasSuccess = results.some((r) => r.status === "fulfilled");

    if (!hasSuccess) {
        throw new Error("Push delivery rejected by browser push service. Please re-subscribe in Settings.");
    }

    console.log(`[PUSH-TEST] ✅ Test delivered to ${deliveredCount}/${subs.length} devices in ${Date.now() - startTime}ms`);
    return { success: true, deliveredCount };
};