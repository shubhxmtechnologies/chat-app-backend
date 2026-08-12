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
     * Prefer Origin when the browser sends it.
     */
    if (origin) {
        if (origin !== envConfig.CLIENT_ORIGIN) {
            throw new AppError(
                "Invalid request origin",
                403
            );
        }

        return next();
    }

    /*
     * Fallback to Referer when Origin is absent.
     */
    const referer = req.get("referer");

    if (referer) {
        try {
            const refererOrigin = new URL(referer).origin;

            if (
                refererOrigin !==
                envConfig.CLIENT_ORIGIN
            ) {
                throw new AppError(
                    "Invalid request origin",
                    403
                );
            }

            return next();
        } catch {
            throw new AppError(
                "Invalid request referer",
                403
            );
        }
    }

    /*
     * Neither Origin nor Referer is present.
     * Fail closed for these sensitive auth endpoints.
     */
    throw new AppError(
        "Origin or Referer header required",
        403
    );
};