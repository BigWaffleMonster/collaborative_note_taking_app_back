import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";

import { config } from "../config";

const jwtSecret = new TextEncoder().encode(config.jwtSecret);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
}

export async function createAccessToken(
  userId: string,
  sessionId: string,
): Promise<string> {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setIssuer(config.jwtIssuer)
    .setAudience(config.jwtAudience)
    .setExpirationTime(`${config.accessTokenTtlSeconds}s`)
    .sign(jwtSecret);
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, jwtSecret, {
    algorithms: ["HS256"],
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });

  if (!payload.sub || typeof payload.sid !== "string") {
    throw new Error("Access token is missing required claims.");
  }

  return {
    userId: payload.sub,
    sessionId: payload.sid,
  };
}

export function createRefreshToken(sessionId: string): string {
  return `${sessionId}.${randomBytes(32).toString("base64url")}`;
}

export function getSessionIdFromRefreshToken(token: string): string | null {
  const parts = token.split(".");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  return uuidPattern.test(parts[0]) ? parts[0] : null;
}

export function hashRefreshToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

export function refreshTokenHashesEqual(left: Buffer, right: Buffer): boolean {
  return left.length === right.length && timingSafeEqual(left, right);
}
