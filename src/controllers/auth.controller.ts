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
const REFRESH_COOKIE_NAME = "refreshToken";

const getRefreshCookieOptions = (req: Request): CookieOptions => {
    const isProduction = envConfig.NODE_ENV === "production";
    
    // Determine if the request is cross-site (different hostnames)
    let isCrossSite = false;
    const origin = req.get("origin");
    if (origin) {
        try {
            const originHostname = new URL(origin).hostname;
            if (originHostname !== req.hostname) {
                isCrossSite = true;
            }
        } catch {
            // Ignore parse errors
        }
    }

    // Cross-site POST requests require SameSite=None and Secure=true
    const requireNone = isProduction || isCrossSite;

    return {
        httpOnly: true,
        secure: requireNone,
        sameSite: requireNone ? "none" : "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };
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
                "Email or username already in use.", 409
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
            getRefreshCookieOptions(req)
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
                globalMute: user.globalMute,
                mutedChats: user.mutedChats,
            },

            refreshToken, // Included in body to bypass Safari third-party cookie blocking
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

        const MAX_FAILED_ATTEMPTS = 5;
        const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

        // Check if account is temporarily locked
        if (user.lockUntil && user.lockUntil > new Date()) {
            const minutesRemaining = Math.max(
                1,
                Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000))
            );
            throw new AppError(
                `Account is temporarily locked due to excessive failed attempts. Please try again in ${minutesRemaining} minute${minutesRemaining === 1 ? "" : "s"}.`,
                429
            );
        }

        const passwordMatches = await bcrypt.compare(
            String(password),
            user.password
        );

        if (!passwordMatches) {
            const currentFailed = (user.failedLoginAttempts || 0) + 1;
            const updateDoc: { failedLoginAttempts: number; lockUntil?: Date } = {
                failedLoginAttempts: currentFailed,
            };

            if (currentFailed >= MAX_FAILED_ATTEMPTS) {
                updateDoc.lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
            }

            await User.findByIdAndUpdate(user._id, { $set: updateDoc });

            throw new AppError(
                "Invalid email or password",
                401
            );
        }

        // Reset failed login attempts on success
        if (user.failedLoginAttempts > 0 || user.lockUntil) {
            user.failedLoginAttempts = 0;
            user.lockUntil = null;
        }

        const userId = user._id.toString();

        const accessToken = signAccessToken(userId);
        const refreshToken = signRefreshToken(userId);

        user.refreshToken = hashToken(refreshToken);

        await user.save();

        res.cookie(
            REFRESH_COOKIE_NAME,
            refreshToken,
            getRefreshCookieOptions(req)
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
                globalMute: user.globalMute,
                mutedChats: user.mutedChats,
            },

            refreshToken, // Included in body to bypass Safari third-party cookie blocking
        });
    }
);


// ----------------------------------------------------
// REFRESH
// POST /api/auth/refresh
// ----------------------------------------------------

export const refresh = asyncHandler(
    async (req: Request, res: Response) => {
        // Fallback to body to bypass mobile Safari third-party cookie blocking
        const refreshToken =
            req.cookies?.refreshToken || req.body?.refreshToken;

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

        // Intentionally NOT rotating the refresh token on every /refresh request.
        // This solves the race condition where multiple rapid requests (e.g. fast tab refresh)
        // would cause a 401 Unauthorized, logging the user out.
        // The refresh token remains valid until expiry or explicit logout.

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
                globalMute: user.globalMute,
                mutedChats: user.mutedChats,
            },
            
            refreshToken, // Send existing token back so frontend can persist it
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

        let loggedOutUserId: string | null = null;

        if (
            typeof refreshToken === "string" &&
            refreshToken
        ) {
            try {
                const decoded =
                    verifyRefreshToken(
                        refreshToken
                    );

                loggedOutUserId = decoded.userId;

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
            getRefreshCookieOptions(req)
        );

        // H3: Force-disconnect all sockets for this user on logout.
        if (loggedOutUserId) {
            try {
                const io = req.app.get("io");
                if (io) {
                    const sockets = await io.in(`user:${loggedOutUserId}`).fetchSockets();
                    for (const s of sockets) {
                        s.emit("auth_error", { message: "Logged out" });
                        s.disconnect(true);
                    }
                }
            } catch {
                // Socket cleanup is best-effort
            }
        }

        res.status(200).json({
            success: true,
            message:
                "Logged out successfully",
        });
    }
);

export const checkUsername = asyncHandler(
    async (req, res) => {
        const { username } = req.body;

        if (!username || typeof username !== "string") {
            throw new AppError("Username is required", 400);
        }

        const normalizedUsername = normalizeUsername(username);

        const existingUser = await User.exists({
            username: normalizedUsername,
        });

        res.status(200).json({
            success: true,
            available: !existingUser,
        });
    }
);

export const checkEmail = asyncHandler(
    async (req, res) => {
        const { email } = req.body;

        if (!email || typeof email !== "string") {
            throw new AppError("Email is required", 400);
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.exists({
            email: normalizedEmail,
        });

        res.status(200).json({
            success: true,
            available: !existingUser,
        });
    }
);