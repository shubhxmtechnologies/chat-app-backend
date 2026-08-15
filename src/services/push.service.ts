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

export const sendPushNotification = async (
    userId: string,
    payload: { title: string; body: string; url: string }
) => {
    try {
        const user = await User.findById(userId);
        if (!user || !user.pushSubscription) return;

        await webpush.sendNotification(user.pushSubscription, JSON.stringify(payload));
    } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription expired or revoked, clean it up
            await User.findByIdAndUpdate(userId, { $set: { pushSubscription: null } });
        } else {
            console.error("Push notification failed:", error);
        }
    }
};