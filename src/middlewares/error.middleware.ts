import type {
    Request,
    Response,
    NextFunction,
} from "express";

import { AppError } from "../utils/appError.util.js";

export const errorHandler = (
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    console.error(err);

    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
        });

        return;
    }

    res.status(500).json({
        success: false,
        message: "Internal server error",
    });
};