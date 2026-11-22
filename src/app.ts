import { Hono } from "hono";

import { AuthError } from "./auth/errors";
import { authRoutes, meRoutes } from "./auth/routes";

export const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/auth", authRoutes);
app.route("/", meRoutes);

app.notFound((c) =>
  c.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
      },
    },
    404,
  ),
);

app.onError((error, c) => {
  if (error instanceof AuthError) {
    return c.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      error.status,
    );
  }

  console.error("Unhandled request error:", error);
  return c.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    },
    500,
  );
});
