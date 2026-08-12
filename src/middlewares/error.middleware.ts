import type {
    Request,
    Response,
    NextFunction,
} from "express";

import { AppError } from "../utils/appError.util.js";
import multer from "multer";

export const errorHandler = (
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (err instanceof AppError && err.statusCode < 500) {
        console.log(`[${err.statusCode}] ${err.message}`);
    } else {
        console.error(err);
    }

    if (res.headersSent) {
        return next(err);
    }


    if (err instanceof multer.MulterError) {

        let message =
            "File upload failed";

        if (
            err.code === "LIMIT_FILE_SIZE"
        ) {
            message =
                "File exceeds maximum allowed size.";
        }

        res.status(413).json({
            success: false,
            message,
        });

        return;
    }
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