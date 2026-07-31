import type {
    Request,
    Response,
    NextFunction,
} from "express";

import { envConfig } from "../config/env.js";
import { AppError } from "../utils/appError.util.js";

export const requireTrustedOrigin = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const origin = req.get("origin");

    /*
     * Browser requests made by your frontend should
     * carry Origin on these POST requests.
     */
    if (!origin) {
        throw new AppError(
            "Origin header required",
            403
        );
    }

    if (origin !== envConfig.CLIENT_ORIGIN) {
        throw new AppError(
            "Invalid request origin",
            403
        );
    }

    next();
};