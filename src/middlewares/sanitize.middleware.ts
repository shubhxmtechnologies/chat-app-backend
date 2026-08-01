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
    req.query = sanitize(req.query) as typeof req.query;
    req.params = sanitize(req.params) as typeof req.params;

    next();
};