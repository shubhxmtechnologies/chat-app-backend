import mongoose from "mongoose";
import { envConfig } from "./env.js";

export const connectDB = async (): Promise<void> => {
    // 1 = connected
    if (mongoose.connection.readyState === 1) {
        console.log("MongoDB already connected");
        return;
    }

    // 2 = connecting
    if (mongoose.connection.readyState === 2) {
        console.log("MongoDB connection already in progress");
        return;
    }

    try {
        await mongoose.connect(envConfig.MONGO_URI, {
            maxPoolSize: 10,
            minPoolSize: 2,
            serverSelectionTimeoutMS: 5000,
        });

        console.log("MongoDB connected");
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        throw error;
    }
};