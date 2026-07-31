import type { TokenPayload } from "../../utils/jwt.util.js";

declare global {
    namespace Express {
        interface Request {
            user?: TokenPayload;
        }
    }
}

export { };