import { Router } from "express";

import { authenticate } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import {
    blockUser,
    unblockUser,
} from "../controllers/user.controller.js";
import { updateBio, updateUsername, uploadAvatar } from "../controllers/user.controller.js";
import { searchUsers } from "../controllers/user.controller.js";
import { searchRateLimiter } from "../middlewares/rateLimiter.middleware.js";

const router = Router();

router.patch(
    "/me/avatar",
    authenticate,
    upload.single("avatar"),
    uploadAvatar
);

router.patch(
    "/me/bio",
    authenticate,
    updateBio
);

router.patch(
    "/me/username",
    authenticate,
    updateUsername
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
    "/search",
    authenticate,
    searchRateLimiter,
    searchUsers
);
export default router;