import { Router } from "express";

import { authenticate } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import {
    blockUser,
    unblockUser,
} from "../controllers/user.controller.js";
import { 
    updateBio, 
    uploadAvatar,
    updateName,
    updateEmail,
    changePassword,
    deleteAvatar,
    getBlockedUsers,
    getProfile
} from "../controllers/user.controller.js";
import { searchUsers } from "../controllers/user.controller.js";
import { searchRateLimiter } from "../middlewares/rateLimiter.middleware.js";

const router = Router();

router.get(
    "/me",
    authenticate,
    getProfile
);

router.patch(
    "/me/avatar",
    authenticate,
    upload.single("avatar"),
    uploadAvatar
);

router.delete(
    "/me/avatar",
    authenticate,
    deleteAvatar
);

router.patch(
    "/me/bio",
    authenticate,
    updateBio
);

router.patch(
    "/me/name",
    authenticate,
    updateName
);

router.patch(
    "/me/email",
    authenticate,
    updateEmail
);

router.patch(
    "/me/password",
    authenticate,
    changePassword
);

router.post(
    "/me/block/:userId",
    authenticate,
    blockUser
);

router.post(
    "/me/unblock/:userId",
    authenticate,
    unblockUser
);

router.get(
    "/me/blocked",
    authenticate,
    getBlockedUsers
);

router.get(
    "/search",
    authenticate,
    searchRateLimiter,
    searchUsers
);
export default router;