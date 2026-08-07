import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import type {
    CookieOptions,
} from "express";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.util.js";
import { AppError } from "../utils/appError.util.js";

import {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
} from "../utils/jwt.util.js";
import { hashToken } from "../utils/token.util.js";
import { envConfig } from "../config/env.js";
import { loginSchema, registerSchema } from "../validators/auth.validator.js";
import { normalizeUsername } from "../utils/username.util.js";

const DUMMY_PASSWORD_HASH = "$2b$12$.7TkQ6nMiPj6k8acLZ9UjuXQ/wddHeIYyI3aZsRDk9nE.IbkUcvSS"


// ----------------------------------------------------
// Cookie configuration
// ----------------------------------------------------
const isProduction =
    envConfig.NODE_ENV === "production";
const REFRESH_COOKIE_NAME = "refreshToken";

const refreshCookieBaseOptions: CookieOptions = {
    httpOnly: true,

    secure: isProduction,

    sameSite: isProduction
        ? "none"
        : "lax",

    path: "/api/auth",
};

const refreshCookieOptions: CookieOptions = {
    ...refreshCookieBaseOptions,

    maxAge:
        7 * 24 * 60 * 60 * 1000,
};

// ----------------------------------------------------
// REGISTER
// POST /api/auth/register
// ----------------------------------------------------

export const register = asyncHandler(
    async (req: Request, res: Response) => {
        const parsed = registerSchema.safeParse(
            req.body
        );
        if (!parsed.success) {
            throw new AppError(
                parsed.error.issues[0]?.message ??
                "Invalid registration data",
                400
            );
        }

        const { username, email, password, firstName, lastName, bio } = parsed.data;

        const normalizedUsername = normalizeUsername(username);
        const normalizedEmail = String(email).trim().toLowerCase();

        const existingUser = await User.findOne({
            $or: [
                { username: normalizedUsername },
                { email: normalizedEmail },
            ],
        });

        if (existingUser) {
            throw new AppError(
                "An account with this username or email already exists",
                409
            );
        }

        /*
         * User.create() triggers your pre("save") hook,
         * so password gets hashed automatically.
         */
        const user = await User.create({
            username: normalizedUsername,
            email: normalizedEmail,
            password,
            name: {
                firstName,
                lastName: lastName ?? null,
            },
            bio: bio?.trim() || null,
            refreshToken: null,
        });

        const userId = user._id.toString();

        const accessToken = signAccessToken(userId);
        const refreshToken = signRefreshToken(userId);

        /*
         * Save refresh token.
         *
         * Password isn't modified, so your pre-save hook
         * will NOT hash the password again.
         */
        user.refreshToken = hashToken(refreshToken);

        await user.save();

        res.cookie(
            REFRESH_COOKIE_NAME,
            refreshToken,
            refreshCookieOptions
        );

        res.status(201).json({
            success: true,

            message: "User registered successfully",

            accessToken,

            user: {
                id: userId,
                username: user.username,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
                bio: user.bio ?? null,
            },
        });
    }
);


// ----------------------------------------------------
// LOGIN
// POST /api/auth/login
// ----------------------------------------------------

export const login = asyncHandler(
    async (req: Request, res: Response) => {

        const parsed = loginSchema.safeParse(
            req.body
        );
        if (!parsed.success) {
            throw new AppError(
                parsed.error.issues[0]?.message ??
                "Invalid login data",
                400
            );
        }
        const { email, password } = parsed.data;

        const normalizedEmail = String(email)
            .trim()
            .toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail,
        });

        /*
         * Don't say whether the email or password was wrong.
         */
        if (!user) {
            await bcrypt.compare(
                String(password),
                DUMMY_PASSWORD_HASH
            );

            throw new AppError(
                "Invalid email or password",
                401
            );
        }

        const passwordMatches = await bcrypt.compare(
            String(password),
            user.password
        );

        if (!passwordMatches) {
            throw new AppError(
                "Invalid email or password",
                401
            );
        }

        const userId = user._id.toString();

        const accessToken = signAccessToken(userId);
        const refreshToken = signRefreshToken(userId);

        user.refreshToken = hashToken(refreshToken);

        await user.save();

        res.cookie(
            REFRESH_COOKIE_NAME,
            refreshToken,
            refreshCookieOptions
        );

        res.status(200).json({
            success: true,

            message: "Login successful",

            accessToken,

            user: {
                id: userId,
                username: user.username,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
                bio: user.bio ?? null,
            }
        });
    }
);


// ----------------------------------------------------
// REFRESH
// POST /api/auth/refresh
// ----------------------------------------------------

export const refresh = asyncHandler(
    async (req: Request, res: Response) => {
        const refreshToken =
            req.cookies?.refreshToken;

        if (
            typeof refreshToken !== "string" ||
            !refreshToken
        ) {
            throw new AppError(
                "Refresh token missing",
                401
            );
        }

        let decoded;

        try {
            decoded =
                verifyRefreshToken(
                    refreshToken
                );
        } catch {
            throw new AppError(
                "Invalid or expired refresh token",
                401
            );
        }

        const user = await User.findById(
            decoded.userId
        );

        if (!user) {
            throw new AppError(
                "Invalid refresh token",
                401
            );
        }

        const presentedTokenHash =
            hashToken(refreshToken);

        if (
            !user.refreshToken ||
            user.refreshToken !==
            presentedTokenHash
        ) {
            throw new AppError(
                "Invalid refresh token",
                401
            );
        }

        const accessToken =
            signAccessToken(
                user._id.toString()
            );

        /*
         * Rotate refresh token.
         */
        const newRefreshToken =
            signRefreshToken(
                user._id.toString()
            );

        user.refreshToken =
            hashToken(
                newRefreshToken
            );

        await user.save();

        res.cookie(
            REFRESH_COOKIE_NAME,
            newRefreshToken,
            refreshCookieOptions
        );

        res.status(200).json({
            success: true,
            accessToken,
            user: {
                id: user._id.toString(),
                username: user.username,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
                bio: user.bio ?? null,
            }
        });
    }
);


// ----------------------------------------------------
// LOGOUT
// POST /api/auth/logout
// ----------------------------------------------------
export const logout = asyncHandler(
    async (req: Request, res: Response) => {
        const refreshToken =
            req.cookies?.refreshToken;

        if (
            typeof refreshToken === "string" &&
            refreshToken
        ) {
            try {
                const decoded =
                    verifyRefreshToken(
                        refreshToken
                    );

                const tokenHash =
                    hashToken(
                        refreshToken
                    );

                await User.updateOne(
                    {
                        _id: decoded.userId,
                        refreshToken:
                            tokenHash,
                    },
                    {
                        $set: {
                            refreshToken: null,
                        },
                    }
                );
            } catch {
                /*
                 * Even if token is expired/invalid,
                 * still clear the browser cookie.
                 */
            }
        }

        res.clearCookie(
            REFRESH_COOKIE_NAME,
            refreshCookieBaseOptions
        );

        res.status(200).json({
            success: true,
            message:
                "Logged out successfully",
        });
    }
);