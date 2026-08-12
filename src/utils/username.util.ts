import { AppError } from "./appError.util.js";

export const normalizeUsername = (
    username: string
): string => {

    const normalized = username
        .trim()
        .toLowerCase();

    // L6: Range aligned with Zod auth validator (5–14 chars)
    if (
        normalized.length < 5 ||
        normalized.length > 14
    ) {
        throw new AppError(
            "Username must be between 5 and 14 characters",
            400
        );
    }

    if (
        !/^[a-z0-9_]+$/.test(normalized)
    ) {
        throw new AppError(
            "Username can only contain letters, numbers and underscores",
            400
        );
    }

    return normalized;
};