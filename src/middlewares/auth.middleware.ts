import type {
    Request,
    Response,
    NextFunction,
} from "express";

import { verifyAccessToken } from "../utils/jwt.util.js";
import { AppError } from "../utils/appError.util.js";

export const authenticate = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    try {
        const authorization = req.headers.authorization;
        let token: string | undefined;

        if (authorization?.startsWith("Bearer ")) {
            token = authorization.slice(7).trim();
        } else if (typeof req.query.token === "string" && req.query.token.trim()) {
            token = req.query.token.trim();
        }

        if (!token) {
            throw new AppError("Unauthorized", 401);
        }

        const decoded = verifyAccessToken(token);

        req.user = decoded;

        next();
    } catch {
        next(new AppError("Invalid or expired access token", 401));
    }
};