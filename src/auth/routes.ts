import { Hono } from "hono";

import { AuthError } from "./errors";
import { getBearerToken, requireAuth } from "./middleware";
import type { AuthVariables } from "./middleware";
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
} from "./schemas";
import {
  loginUser,
  logoutSession,
  refreshSession,
  registerUser,
} from "./service";

export const authRoutes = new Hono<{ Variables: AuthVariables }>();

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function invalidBody(): AuthError {
  return new AuthError(400, "VALIDATION_ERROR", "Request body is invalid.");
}

authRoutes.post("/register", async (c) => {
  const parsed = registerSchema.safeParse(await readJson(c.req.raw));

  if (!parsed.success) {
    throw invalidBody();
  }

  const response = await registerUser(parsed.data);
  return c.json(response, 201);
});

authRoutes.post("/login", async (c) => {
  const parsed = loginSchema.safeParse(await readJson(c.req.raw));

  if (!parsed.success) {
    throw invalidBody();
  }

  return c.json(await loginUser(parsed.data));
});

authRoutes.post("/refresh", async (c) => {
  const parsed = refreshSchema.safeParse(await readJson(c.req.raw));

  if (!parsed.success) {
    throw invalidBody();
  }

  return c.json(await refreshSession(parsed.data.refreshToken));
});

authRoutes.post("/logout", async (c) => {
  const parsed = logoutSchema.safeParse((await readJson(c.req.raw)) ?? {});

  if (!parsed.success) {
    throw invalidBody();
  }

  await logoutSession({
    refreshToken: parsed.data.refreshToken,
    accessToken: getBearerToken(c.req.header("Authorization")) ?? undefined,
  });

  return c.body(null, 204);
});

export const meRoutes = new Hono<{ Variables: AuthVariables }>();

meRoutes.get("/me", requireAuth, (c) => c.json({ user: c.get("user") }));
