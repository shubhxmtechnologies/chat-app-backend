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

export const getBlockDirection = async (
    currentUserId: string,
    otherUserId: string
): Promise<{ blockedByMe: boolean; blockedByThem: boolean }> => {
    const [blockedByMe, blockedByThem] = await Promise.all([
        User.exists({
            _id: currentUserId,
            blockedUsers: otherUserId,
        }),
        User.exists({
            _id: otherUserId,
            blockedUsers: currentUserId,
        }),
    ]);

    return {
        blockedByMe: blockedByMe !== null,
        blockedByThem: blockedByThem !== null,
    };
};