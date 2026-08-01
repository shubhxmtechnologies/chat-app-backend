import { Router } from "express";

import {
    sendMessage,
    getMessages,
    sendMediaMessage,
    updateMessage,
    removeMessageForEveryone,
    sendMessageBatch,
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
router.patch(
    "/:messageId",
    authenticate,
    messageRateLimiter,
    updateMessage
);
router.delete(
    "/:messageId",
    authenticate,
    messageRateLimiter,
    removeMessageForEveryone
);

router.post(
    "/batch",
    authenticate,
    messageRateLimiter,
    sendMessageBatch
);
export default router;