import { User } from "../models/user.model.js";

export const isBlockedEitherWay = async (
    userIdA: string,
    userIdB: string
): Promise<boolean> => {
    const blocked = await User.exists({
        $or: [
            {
                _id: userIdA,
                blockedUsers: userIdB,
            },
            {
                _id: userIdB,
                blockedUsers: userIdA,
            },
        ],
    });

    return blocked !== null;
};