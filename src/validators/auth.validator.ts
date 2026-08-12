import { z } from "zod";

export const registerSchema = z.object({
    username: z
        .string()
        .trim()
        .toLowerCase()
        .min(5, "Username must be between 5 and 14 characters")
        .max(14, "Username must be between 5 and 14 characters")
        .regex(
            /^[a-z0-9_]+$/,
            "Username can only contain letters, numbers and underscores"
        ),

    email: z
        .string()
        .trim()
        .toLowerCase()
        .email("Invalid email address")
        .min(13, "Email must be between 13 and 30 characters")
        .max(30, "Email must be between 13 and 30 characters"),

    password: z
        .string()
        .min(8, "Password must be between 8 and 16 characters")
        .max(16, "Password must be between 8 and 16 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one digit"),

    firstName: z
        .string()
        .trim()
        .min(1, "First name is required")
        .max(50, "First name cannot exceed 50 characters"),

    lastName: z
        .string()
        .trim()
        .max(50, "Last name cannot exceed 50 characters")
        .nullish(),

    bio: z
        .string()
        .trim()
        .max(200, "Bio cannot exceed 200 characters")
        .nullish(),
});

export const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .toLowerCase()
        .email("Invalid email address")
        .min(13, "Email must be between 13 and 30 characters")
        .max(30, "Email must be between 13 and 30 characters"),

    password: z
        .string()
        .min(8, "Password must be between 8 and 16 characters")
        .max(16, "Password must be between 8 and 16 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one digit"),
});