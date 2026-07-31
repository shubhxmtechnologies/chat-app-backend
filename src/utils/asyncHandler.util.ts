import type {
    Request,
    Response,
    NextFunction,
    RequestHandler,
} from "express";

import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";

export const asyncHandler = <
    P = ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = ParsedQs
>(
    fn: (
        req: Request<P, ResBody, ReqBody, ReqQuery>,
        res: Response<ResBody>,
        next: NextFunction
    ) => Promise<unknown>
): RequestHandler<P, ResBody, ReqBody, ReqQuery> => {
    return (req, res, next) => {
        void Promise.resolve(fn(req, res, next)).catch(next);
    };
};