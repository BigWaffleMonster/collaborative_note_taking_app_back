import { z } from "zod";

const email = z
  .email("Enter a valid email address.")
  .trim()
  .max(320)
  .transform((value) => value.toLowerCase());

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password: z.string().min(12).max(128),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(2_048),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1).max(2_048).nullable().optional(),
});
