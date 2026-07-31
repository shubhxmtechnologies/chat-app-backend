import { Router } from "express";

import {
    sendMessage,
    getMessages,
} from "../controllers/message.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";

import {
    messageRateLimiter,
} from "../middlewares/rateLimiter.middleware.js";

const router = Router();

router.post("/", authenticate, messageRateLimiter, sendMessage);
router.get("/:chatId", authenticate, getMessages);

export default router;