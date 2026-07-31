import "dotenv/config";
import http from "http";

import { app } from "./app.js";
import { envConfig } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { setupSocket } from "./socket/index.js";

let server = http.createServer(app);
setupSocket(server);

const startServer = async (): Promise<void> => {
    try {
        await connectDB();

        server.listen(envConfig.PORT, () => {
            console.log(`Server running on port ${envConfig.PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();