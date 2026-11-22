import type { TransactionSql } from 'postgres'

import { config } from '../config'
import { sql } from '../db'
import { AuthError } from './errors'
import { hashPassword, verifyPassword } from './password'
import {
  createAccessToken,
  createRefreshToken,
  getSessionIdFromRefreshToken,
  hashRefreshToken,
  refreshTokenHashesEqual,
  verifyAccessToken
} from './tokens'
import { toUser } from './types'
import type { AuthResponse, User, UserRow } from './types'

interface SessionUserRow {
  session_id: string
  user_id: string
  email: string
  name: string
  refresh_token_hash: string
  expires_at: Date
  revoked_at: Date | null
}

async function issueAuthResponse(
  user: User,
  sessionId: string
): Promise<AuthResponse> {
  const refreshToken = createRefreshToken(sessionId)
  const accessToken = await createAccessToken(user.id, sessionId)

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn: config.accessTokenTtlSeconds,
    refreshTokenExpiresIn: config.refreshTokenTtlSeconds,
    user
  }
}

async function createSession(
  transaction: TransactionSql,
  user: User
): Promise<AuthResponse> {
  const sessionId = crypto.randomUUID()
  const response = await issueAuthResponse(user, sessionId)
  const expiresAt = new Date(Date.now() + config.refreshTokenTtlSeconds * 1_000)

  await transaction`
    INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at)
    VALUES (
      ${sessionId},
      ${user.id},
      ${hashRefreshToken(response.refreshToken)},
      ${expiresAt}
    )
  `

  return response
}

export async function registerUser(input: {
  name: string
  email: string
  password: string
}): Promise<AuthResponse> {
  const passwordHash = await hashPassword(input.password)

  return sql.begin(async (transaction) => {
    const users = await transaction<UserRow[]>`
      INSERT INTO users (email, password_hash, name)
      VALUES (${input.email}, ${passwordHash}, ${input.name})
      ON CONFLICT DO NOTHING
      RETURNING id, email, name, password_hash
    `
    const userRow = users[0]

    if (!userRow) {
      throw new AuthError(
        409,
        'EMAIL_ALREADY_EXISTS',
        'A user with this email already exists.'
      )
    }

    return createSession(transaction, toUser(userRow))
  })
}

export async function loginUser(input: {
  email: string
  password: string
}): Promise<AuthResponse> {
  const users = await sql<UserRow[]>`
    SELECT id, email, name, password_hash
    FROM users
    WHERE lower(email) = lower(${input.email})
    LIMIT 1
  `
  const userRow = users[0]

  if (
    !userRow ||
    !(await verifyPassword(input.password, userRow.password_hash))
  ) {
    throw new AuthError(
      401,
      'INVALID_CREDENTIALS',
      'Invalid email or password.'
    )
  }

  const user = toUser(userRow)
  return sql.begin((transaction) => createSession(transaction, user))
}

export async function refreshSession(
  refreshToken: string
): Promise<AuthResponse> {
  const sessionId = getSessionIdFromRefreshToken(refreshToken)

  if (!sessionId) {
    throw new AuthError(
      401,
      'INVALID_REFRESH_TOKEN',
      'Refresh token is invalid or expired.'
    )
  }

  const response = await sql.begin(
    async (transaction): Promise<AuthResponse | null> => {
      const sessions = await transaction<SessionUserRow[]>`
      SELECT
        s.id AS session_id,
        s.refresh_token_hash,
        s.expires_at,
        s.revoked_at,
        u.id AS user_id,
        u.email,
        u.name
      FROM auth_sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.id = ${sessionId}
      FOR UPDATE OF s
    `
      const session = sessions[0]

      if (!session) {
        return null
      }

      if (session.revoked_at || session.expires_at.getTime() <= Date.now()) {
        return null
      }

      const storedHash = Buffer.from(session.refresh_token_hash, 'hex')
      const receivedHash = hashRefreshToken(refreshToken)

      if (!refreshTokenHashesEqual(storedHash, receivedHash)) {
        await transaction`
        UPDATE auth_sessions
        SET
          revoked_at = now(),
          revoke_reason = 'refresh_token_reuse',
          updated_at = now()
        WHERE id = ${sessionId} AND revoked_at IS NULL
      `
        return null
      }

      const user: User = {
        id: session.user_id,
        email: session.email,
        name: session.name
      }
      const nextResponse = await issueAuthResponse(user, sessionId)

      await transaction`
      UPDATE auth_sessions
      SET
        refresh_token_hash = ${hashRefreshToken(nextResponse.refreshToken)},
        expires_at = ${new Date(Date.now() + config.refreshTokenTtlSeconds * 1_000)},
        updated_at = now()
      WHERE id = ${sessionId}
    `

      return nextResponse
    }
  )

  if (!response) {
    throw new AuthError(
      401,
      'INVALID_REFRESH_TOKEN',
      'Refresh token is invalid or expired.'
    )
  }

  return response
}

export async function logoutSession(input: {
  refreshToken?: string | null
  accessToken?: string
}): Promise<void> {
  if (input.refreshToken) {
    const sessionId = getSessionIdFromRefreshToken(input.refreshToken)

    if (sessionId) {
      const sessions = await sql<{ refresh_token_hash: string }[]>`
        SELECT refresh_token_hash
        FROM auth_sessions
        WHERE id = ${sessionId}
        LIMIT 1
      `
      const session = sessions[0]

      if (
        session &&
        refreshTokenHashesEqual(
          Buffer.from(session.refresh_token_hash, 'hex'),
          hashRefreshToken(input.refreshToken)
        )
      ) {
        await sql`
          UPDATE auth_sessions
          SET revoked_at = now(), revoke_reason = 'logout', updated_at = now()
          WHERE id = ${sessionId} AND revoked_at IS NULL
        `
        return
      }
    }
  }

  if (input.accessToken) {
    try {
      const claims = await verifyAccessToken(input.accessToken)
      await sql`
        UPDATE auth_sessions
        SET revoked_at = now(), revoke_reason = 'logout', updated_at = now()
        WHERE id = ${claims.sessionId}
          AND user_id = ${claims.userId}
          AND revoked_at IS NULL
      `
    } catch {
      // Logout is intentionally idempotent and does not reveal session validity.
    }
  }
}

export async function getCurrentUser(
  accessToken: string
): Promise<User | null> {
  let claims

  try {
    claims = await verifyAccessToken(accessToken)
  } catch {
    return null
  }

  const users = await sql<UserRow[]>`
    SELECT u.id, u.email, u.name, u.password_hash
    FROM auth_sessions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.id = ${claims.sessionId}
      AND u.id = ${claims.userId}
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
    LIMIT 1
  `
  const user = users[0]

  return user ? toUser(user) : null
}
