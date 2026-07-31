import jwt from "jsonwebtoken";
import type { StringValue } from "ms";

import { envConfig } from "../config/env.js";

export interface TokenPayload extends jwt.JwtPayload {
    userId: string;
}

export const signAccessToken = (userId: string): string => {
    return jwt.sign(
        { userId },
        envConfig.JWT_ACCESS_SECRET,
        {
            expiresIn: envConfig.ACCESS_TOKEN_EXPIRY as StringValue,
        }
    );
};

export const signRefreshToken = (userId: string): string => {
    return jwt.sign(
        { userId },
        envConfig.JWT_REFRESH_SECRET,
        {
            expiresIn: envConfig.REFRESH_TOKEN_EXPIRY as StringValue,
        }
    );
};

export const verifyAccessToken = (token: string): TokenPayload => {
    const decoded = jwt.verify(
        token,
        envConfig.JWT_ACCESS_SECRET
    );

    if (typeof decoded === "string" || !decoded.userId) {
        throw new Error("Invalid access token");
    }

    return decoded as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
    const decoded = jwt.verify(
        token,
        envConfig.JWT_REFRESH_SECRET
    );

    if (typeof decoded === "string" || !decoded.userId) {
        throw new Error("Invalid refresh token");
    }

    return decoded as TokenPayload;
};