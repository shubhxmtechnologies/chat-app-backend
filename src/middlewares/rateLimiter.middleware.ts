import { rateLimit } from "express-rate-limit";

export const generalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many requests. Please try again later.",
    },
});

export const healthRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many health check requests.",
    },
});

export const refreshRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many token refresh attempts. Please try again later.",
    },
});

export const logoutRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many logout requests. Please try again later.",
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


export const searchRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "You're searching too quickly.",
    },
});

export const checkAvailabilityLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many checks. Please try again later.",
    },
});