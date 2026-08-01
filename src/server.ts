import "dotenv/config";
import http from "http";

import { app } from "./app.js";
import { envConfig } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { setupSocket } from "./socket/index.js";
import { startJobScheduler } from "./jobs/scheduler.job.js";

const server = http.createServer(app);
const io = setupSocket(server);

app.set("io", io);
const startServer = async (): Promise<void> => {
    try {
        await connectDB();
        startJobScheduler();
        server.listen(envConfig.PORT, () => {
            console.log(`Server running on port ${envConfig.PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();