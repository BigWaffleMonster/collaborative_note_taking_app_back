# Bun + Hono auth API

Backend for Collaborative Notes. It owns users, password verification, JWT access tokens and database-backed refresh sessions. Token responses are intended for the Next.js BFF, not for direct browser access.

## Setup

```bash
bun install
cp .env.example .env
```

Set a random `JWT_SECRET` and configure `DATABASE_URL`, then create the database and apply the migration:

```bash
bun run migrate
bun run dev
```

The API listens on `http://localhost:3001` by default.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create a user and session |
| `POST` | `/auth/login` | Verify credentials and create a session |
| `POST` | `/auth/refresh` | Rotate refresh token and issue a new access token |
| `POST` | `/auth/logout` | Revoke the current session |
| `GET` | `/me` | Return the user for a valid Bearer access token |
| `GET` | `/health` | Health check |

Refresh tokens are opaque, stored as SHA-256 hashes and rotated on every refresh. Reusing an older token revokes the session. Passwords are hashed with Argon2id through `Bun.password`.

## Checks

```bash
bun run typecheck
bun test
```
