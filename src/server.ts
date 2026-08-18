import "dotenv/config";
import http from "http";

import { app } from "./app.js";
import { envConfig } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { setupSocket } from "./socket/index.js";
import { startJobScheduler } from "./jobs/scheduler.job.js";

const server = http.createServer(app);

// Slowloris & Connection Exhaustion DoS Hardening
server.requestTimeout = 30000; // 30 seconds max to receive complete request
server.headersTimeout = 35000; // 35 seconds max for HTTP headers
server.keepAliveTimeout = 5000; // 5 seconds keep-alive idle timeout
server.maxHeadersCount = 100; // Max HTTP headers count

const io = setupSocket(server);

app.set("io", io);
const startServer = async (): Promise<void> => {
    try {
        await connectDB();
        startJobScheduler();
        server.listen(envConfig.PORT, () => {
            const currentDateTime = new Intl.DateTimeFormat("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            }).format(new Date());

            console.log(`Server started: ${currentDateTime}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();