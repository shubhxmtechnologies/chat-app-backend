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

interface PushState {
    lastSentTimestamp: number;
    pendingTimer: NodeJS.Timeout | null;
    burstCount: number;
    latestBody: string;
    options: PushNotificationOptions;
}

// In-memory queue to throttle rapid-fire bursts while keeping 1st message instant (real-time)
const pushStates = new Map<string, PushState>();

const BURST_THROTTLE_WINDOW_MS = 3500; // 3.5 seconds throttle window for bursts

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
        const now = Date.now();
        const state = pushStates.get(queueKey);

        // 1. FIRST MESSAGE (or after quiet period): Send IMMEDIATELY (Real-Time 0ms delay)
        if (!state || (now - state.lastSentTimestamp > BURST_THROTTLE_WINDOW_MS && !state.pendingTimer)) {
            const newState: PushState = {
                lastSentTimestamp: now,
                pendingTimer: null,
                burstCount: 1,
                latestBody: options.body,
                options,
            };
            pushStates.set(queueKey, newState);
            await executePushSend(recipientId, options, 1, options.body);
            return;
        }

        // 2. SUBSEQUENT RAPID MESSAGES (Anti-Spam Burst): Buffer and collapse
        state.burstCount += 1;
        state.latestBody = options.body;
        state.options = options;

        if (!state.pendingTimer) {
            const remainingDelay = Math.max(1200, BURST_THROTTLE_WINDOW_MS - (now - state.lastSentTimestamp));
            state.pendingTimer = setTimeout(async () => {
                const currentState = pushStates.get(queueKey);
                if (currentState && currentState.burstCount > 1) {
                    const totalCount = currentState.burstCount;
                    const body = currentState.latestBody;
                    const opts = currentState.options;
                    currentState.lastSentTimestamp = Date.now();
                    currentState.pendingTimer = null;
                    currentState.burstCount = 0;
                    await executePushSend(recipientId, opts, totalCount, body);
                } else if (currentState) {
                    currentState.pendingTimer = null;
                    currentState.burstCount = 0;
                }
            }, remainingDelay);
        }
    } catch (err) {
        console.error("Error scheduling push notification:", err);
    }
};