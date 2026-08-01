import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { envConfig } from "./config/env.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import {
    generalRateLimiter,
} from "./middlewares/rateLimiter.middleware.js";
// routes
import authRoutes from "./routes/auth.routes.js"
import chatRoutes from "./routes/chat.routes.js";
import messageRoutes from "./routes/message.routes.js";
import userRoutes from "./routes/user.routes.js";
const app = express();
app.set("trust proxy", 1);

// --------------------
// GLOBAL MIDDLEWARES
// --------------------

app.use(
    express.json({
        limit: "100kb",
    })
);
app.use(cookieParser());

app.use(
    cors({
        origin: envConfig.CLIENT_ORIGIN,
        credentials: true,
    })
);

app.use(generalRateLimiter);

// --------------------
// ROUTES
// --------------------

app.get("/api/health", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "OK",
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);

// --------------------
// 404
// --------------------

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`,
    });
});


// --------------------
// GLOBAL ERROR HANDLER
// MUST BE LAST
// --------------------

app.use(errorHandler);

export { app };