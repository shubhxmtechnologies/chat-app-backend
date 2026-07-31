import { Router } from "express";

import {
    createOrGetChat,
    getUserChats,
} from "../controllers/chat.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authenticate, createOrGetChat);
router.get("/", authenticate, getUserChats);

export default router;