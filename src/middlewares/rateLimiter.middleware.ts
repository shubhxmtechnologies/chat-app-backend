import { rateLimit } from "express-rate-limit";

export const generalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many requests. Please try again later.",
    },
});

export const messageRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "You're sending messages too quickly.",
    },
});

export const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many login attempts. Please try again later.",
    },
});

export const registerRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many registration attempts. Please try again later.",
    },
});
