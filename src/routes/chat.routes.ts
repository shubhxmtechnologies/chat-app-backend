import { Router } from "express";
import {
    createOrGetChat,
    getUserChats,
    deleteChatForMeHandler,
    deleteChatForEveryoneHandler,
} from "../controllers/chat.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authenticate, createOrGetChat);
router.get("/", authenticate, getUserChats);

router.delete("/:chatId/me", authenticate, deleteChatForMeHandler);
router.delete("/:chatId/everyone", authenticate, deleteChatForEveryoneHandler);

export default router;