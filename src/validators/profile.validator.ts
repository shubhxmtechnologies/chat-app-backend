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
        .email("Invalid email address")
        .min(13, "Email must be between 13 and 30 characters")
        .max(30, "Email must be between 13 and 30 characters"),
});

export const changePasswordSchema = z.object({
    currentPassword: z
        .string()
        .min(8, "Current password must be between 8 and 16 characters")
        .max(16, "Current password must be between 8 and 16 characters"),
        
    newPassword: z
        .string()
        .min(8, "New password must be between 8 and 16 characters")
        .max(16, "New password must be between 8 and 16 characters"),
});

export const updateBioSchema = z.object({
    bio: z
        .string()
        .trim()
        .max(200, "Bio cannot exceed 200 characters")
        .nullish(),
});
