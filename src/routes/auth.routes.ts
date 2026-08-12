import { Router } from "express";

import {
    register,
    login,
    refresh,
    logout,
    checkUsername,
    checkEmail,
} from "../controllers/auth.controller.js";

import {
    loginRateLimiter,
    registerRateLimiter,
    checkAvailabilityLimiter,
} from "../middlewares/rateLimiter.middleware.js";

import {
    requireTrustedOrigin,
} from "../middlewares/origin.middleware.js";

const router = Router();

router.post(
    "/register",
    registerRateLimiter,
    requireTrustedOrigin,
    register
);

router.post(
    "/login",
    loginRateLimiter,
    requireTrustedOrigin,
    login
);

router.post(
    "/refresh",
    requireTrustedOrigin,
    refresh
);

router.post(
    "/logout",
    requireTrustedOrigin,
    logout
);

router.post(
    "/check-username",
    checkAvailabilityLimiter,
    requireTrustedOrigin,
    checkUsername
);

router.post(
    "/check-email",
    checkAvailabilityLimiter,
    requireTrustedOrigin,
    checkEmail
);


export default router;