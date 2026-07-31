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

        if (!authorization?.startsWith("Bearer ")) {
            throw new AppError("Unauthorized", 401);
        }

        const token = authorization.slice(7).trim();

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