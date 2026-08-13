import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
    getSupportTicket,
    sendSupportMessage,
    markSupportRead
} from "../controllers/support.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", getSupportTicket);
router.post("/message", sendSupportMessage);
router.post("/read", markSupportRead);

export default router;
