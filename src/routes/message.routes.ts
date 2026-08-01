import { Router } from "express";

import {
    sendMessage,
    getMessages,
    sendMediaMessage,
} from "../controllers/message.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";

import {
    messageRateLimiter,
} from "../middlewares/rateLimiter.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = Router();

router.post("/", authenticate, messageRateLimiter, sendMessage);
router.get("/:chatId", authenticate, getMessages);
router.post(
    "/media",
    authenticate,
    messageRateLimiter,
    upload.single("media"),
    sendMediaMessage
);
export default router;