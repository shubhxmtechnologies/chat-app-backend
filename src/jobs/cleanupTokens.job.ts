import ms from "ms";
import type { StringValue } from "ms";

import { User } from "../models/user.model.js";
import { envConfig } from "../config/env.js";

export const cleanupTokens = async () => {
    const expiryMs = ms(
        envConfig.REFRESH_TOKEN_EXPIRY as StringValue
    );

    const cutoff = new Date(
        Date.now() - expiryMs
    );

    const result = await User.updateMany(
        {
            refreshToken: {
                $ne: null,
            },

            updatedAt: {
                $lt: cutoff,
            },
        },
        {
            $set: {
                refreshToken: null,
            },
        }
    );

    console.log(
        `Cleared ${result.modifiedCount} stale refresh tokens`
    );
};