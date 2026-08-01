import { Router } from "express";

import { authenticate } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

import { updateBio, updateUsername, uploadAvatar } from "../controllers/user.controller.js";

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
export default router;