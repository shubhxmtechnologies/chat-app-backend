import { Router } from "express";

import {
    register,
    login,
    refresh,
    logout,
} from "../controllers/auth.controller.js";

import {
    loginRateLimiter,
    registerRateLimiter,
} from "../middlewares/rateLimiter.middleware.js";

import {
    requireTrustedOrigin,
} from "../middlewares/origin.middleware.js";

const router = Router();

router.post(
    "/register",
    registerRateLimiter,
    register
);

router.post(
    "/login",
    loginRateLimiter,
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

export default router;