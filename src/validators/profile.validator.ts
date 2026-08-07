import { z } from "zod";

export const updateNameSchema = z.object({
    firstName: z
        .string()
        .trim()
        .min(1)
        .max(50),
        
    lastName: z
        .string()
        .trim()
        .max(50)
        .optional(),
});

export const updateEmailSchema = z.object({
    email: z
        .string()
        .trim()
        .email()
        .max(254),
});

export const changePasswordSchema = z.object({
    currentPassword: z
        .string()
        .min(1, "Current password is required"),
        
    newPassword: z
        .string()
        .min(8)
        .max(128),
});

export const updateBioSchema = z.object({
    bio: z
        .string()
        .trim()
        .max(200)
        .optional(),
});
