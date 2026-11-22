import { createMiddleware } from "hono/factory";

import { AuthError } from "./errors";
import { getCurrentUser } from "./service";
import type { User } from "./types";

export interface AuthVariables {
  user: User;
}

export function getBearerToken(
  authorization: string | undefined,
): string | null {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const token = getBearerToken(c.req.header("Authorization"));
    const user = token ? await getCurrentUser(token) : null;

    if (!user) {
      throw new AuthError(401, "UNAUTHORIZED", "Authentication is required.");
    }

    c.set("user", user);
    await next();
  },
);
