import { z } from "zod";

export const updateNameSchema = z.object({
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
});

export const updateEmailSchema = z.object({
    email: z
        .string()
        .trim()
        .toLowerCase()
        .email("Invalid email address")
        .min(13, "Email must be between 13 and 30 characters")
        .max(30, "Email must be between 13 and 30 characters"),
});

export const changePasswordSchema = z.object({
    currentPassword: z
        .string()
        .min(8, "Current password must be between 8 and 16 characters")
        .max(16, "Current password must be between 8 and 16 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one digit"),

    newPassword: z
        .string()
        .min(8, "New password must be between 8 and 16 characters")
        .max(16, "New password must be between 8 and 16 characters")
        .regex(/[A-Z]/, "   Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one digit"),
});

export const updateBioSchema = z.object({
    bio: z
        .string()
        .trim()
        .max(200, "Bio cannot exceed 200 characters")
        .nullish(),
});
