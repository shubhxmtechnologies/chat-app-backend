import type {
    Request,
    Response,
    NextFunction,
} from "express";

const sanitize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map(sanitize);
    }

    if (
        value !== null &&
        typeof value === "object"
    ) {
        const result: Record<string, unknown> = {};

        for (const [key, val] of Object.entries(value)) {
            /*
             * Remove MongoDB operators and dotted keys.
             */
            if (
                key.startsWith("$") ||
                key.includes(".")
            ) {
                continue;
            }

            result[key] = sanitize(val);
        }

        return result;
    }

    return value;
};

export const sanitizeRequest = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    req.body = sanitize(req.body);

    // req.query and req.params are read-only getters in Express 5,
    // so we sanitize their values in-place instead of reassigning.
    for (const key of Object.keys(req.query)) {
        (req.query as Record<string, unknown>)[key] = sanitize(req.query[key]);
    }

    for (const key of Object.keys(req.params)) {
        req.params[key] = sanitize(req.params[key]) as string;
    }

    next();
};