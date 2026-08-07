import { z } from "zod";

export const registerSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3)
        .max(30)
        .regex(
            /^[a-zA-Z0-9_]+$/,
            "Username can only contain letters, numbers and underscores"
        ),

    email: z
        .string()
        .trim()
        .email()
        .max(254),

    password: z
        .string()
        .min(8)
        .max(128),
        
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
        
    bio: z
        .string()
        .trim()
        .max(200)
        .optional(),
});

export const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .email()
        .max(254),

    password: z
        .string()
        .min(1)
        .max(128),
});