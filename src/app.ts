import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { envConfig } from "./config/env.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import {
    generalRateLimiter,
    healthRateLimiter,
} from "./middlewares/rateLimiter.middleware.js";
import {
    sanitizeRequest,
} from "./middlewares/sanitize.middleware.js";
// routes
import authRoutes from "./routes/auth.routes.js"
import chatRoutes from "./routes/chat.routes.js";
import messageRoutes from "./routes/message.routes.js";
import userRoutes from "./routes/user.routes.js";
import supportRoutes from "./routes/support.route.js";
const app = express();

// H2: Only trust proxy headers in production (behind a real reverse proxy).
// In dev, this prevents IP spoofing via X-Forwarded-For to bypass rate limiters.
if (envConfig.NODE_ENV === "production") {
    app.set("trust proxy", "loopback, linklocal, uniquelocal");
}

// L3: Explicit helmet configuration with strict security headers.
app.use(helmet({
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
}));

// --------------------
// GLOBAL MIDDLEWARES
// --------------------

app.use(
    cors({
        origin: envConfig.CLIENT_ORIGIN,
        credentials: true,
    })
);

// Payload size constraints for DoS prevention
app.use(
    express.json({
        limit: "50kb",
    })
);

app.use(
    express.urlencoded({
        extended: false,
        limit: "10kb",
    })
);

app.use(cookieParser());
app.use(sanitizeRequest);

app.use(generalRateLimiter);

// --------------------
// ROUTES
// --------------------

app.get("/api/health", healthRateLimiter, (_req, res) => {
    res.status(200).json({
        success: true,
        message: "OK",
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/support", supportRoutes);

// --------------------
// 404
// --------------------

// M2: Don't leak route/method in 404 — helps attackers enumerate the API.
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});


// --------------------
// GLOBAL ERROR HANDLER
// MUST BE LAST
// --------------------

app.use(errorHandler);

export { app };