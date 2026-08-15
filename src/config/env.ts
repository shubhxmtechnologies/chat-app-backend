import type { EnvConfig } from "../types/env.types.js";

function getEnv(key: string): string {
    const value = process.env[key];

    if (!value) {
        throw new Error(`Missing environment variable: ${key}`);
    }

    return value;
}

export const envConfig: EnvConfig = {
    PORT: getEnv("PORT"),
    MONGO_URI: getEnv("MONGO_URI"),
    JWT_ACCESS_SECRET: getEnv("JWT_ACCESS_SECRET"),
    JWT_REFRESH_SECRET: getEnv("JWT_REFRESH_SECRET"),
    ACCESS_TOKEN_EXPIRY: getEnv("ACCESS_TOKEN_EXPIRY"),
    REFRESH_TOKEN_EXPIRY: getEnv("REFRESH_TOKEN_EXPIRY"),
    CLIENT_ORIGIN: getEnv("CLIENT_ORIGIN"),
    NODE_ENV: getEnv("NODE_ENV"),
    CLOUDINARY_CLOUD_NAME: getEnv(
        "CLOUDINARY_CLOUD_NAME"
    ),
    CLOUDINARY_API_KEY: getEnv(
        "CLOUDINARY_API_KEY"
    ),
    CLOUDINARY_API_SECRET: getEnv(
        "CLOUDINARY_API_SECRET"
    ),
    VAPID_PUBLIC_KEY: getEnv("VAPID_PUBLIC_KEY"),
    VAPID_PRIVATE_KEY: getEnv("VAPID_PRIVATE_KEY"),
    
};