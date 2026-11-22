import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgres://postgres:postgres@localhost:5432/collaborative_notes"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must contain at least 32 characters"),
  JWT_ISSUER: z.string().min(1).default("collaborative-notes"),
  JWT_AUDIENCE: z.string().min(1).default("collaborative-notes-web"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .default(2_592_000),
});

const parsedEnv = envSchema.safeParse(Bun.env);

if (!parsedEnv.success) {
  throw new Error(
    `Invalid environment configuration: ${z.prettifyError(parsedEnv.error)}`,
  );
}

export const config = {
  port: parsedEnv.data.PORT,
  databaseUrl: parsedEnv.data.DATABASE_URL,
  jwtSecret: parsedEnv.data.JWT_SECRET,
  jwtIssuer: parsedEnv.data.JWT_ISSUER,
  jwtAudience: parsedEnv.data.JWT_AUDIENCE,
  accessTokenTtlSeconds: parsedEnv.data.ACCESS_TOKEN_TTL_SECONDS,
  refreshTokenTtlSeconds: parsedEnv.data.REFRESH_TOKEN_TTL_SECONDS,
};
