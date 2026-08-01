import { AppError } from "./appError.util.js";

export const normalizeUsername = (
    username: string
): string => {

    const normalized = username
        .trim()
        .toLowerCase();

    if (
        normalized.length < 3 ||
        normalized.length > 30
    ) {
        throw new AppError(
            "Username must be between 3 and 30 characters",
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