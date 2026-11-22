import { describe, expect, it } from "bun:test";

Bun.env.JWT_SECRET = "test-only-secret-with-at-least-32-characters";

const { hashPassword, verifyPassword } = await import("../src/auth/password");
const {
  createAccessToken,
  createRefreshToken,
  getSessionIdFromRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
} = await import("../src/auth/tokens");

describe("password hashing", () => {
  it("hashes and verifies an Argon2id password", async () => {
    const password = "a-secure-test-password";
    const hash = await hashPassword(password);

    expect(hash).toContain("argon2id");
    expect(hash).not.toContain(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});

describe("access tokens", () => {
  it("creates and verifies a token with user and session claims", async () => {
    const userId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const token = await createAccessToken(userId, sessionId);

    expect(await verifyAccessToken(token)).toEqual({ userId, sessionId });
    await expect(verifyAccessToken(`${token}tampered`)).rejects.toThrow();
  });
});

describe("refresh tokens", () => {
  it("binds an opaque token to a session and hashes it", () => {
    const sessionId = crypto.randomUUID();
    const token = createRefreshToken(sessionId);

    expect(getSessionIdFromRefreshToken(token)).toBe(sessionId);
    expect(getSessionIdFromRefreshToken("not-a-refresh-token")).toBeNull();
    expect(hashRefreshToken(token).toString("hex")).not.toBe(token);
  });
});
