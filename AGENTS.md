# Backend — Collaborative Notes

## Назначение

Backend на Bun + Hono отвечает за пользователей, аутентификацию и серверные сессии. Он является источником истины для проверки JWT и прав доступа. Next.js обращается к нему как BFF; браузер не должен напрямую получать auth-ответы с токенами.

## Стек

- Bun, TypeScript, Hono.
- PostgreSQL через `postgres` (postgres.js).
- Zod для входных данных и конфигурации.
- `jose` для JWT.
- `Bun.password` с Argon2id для паролей.

## Запуск и проверки

```bash
bun install
cp .env.example .env
bun run migrate
bun run dev
```

Перед запуском задать случайный `JWT_SECRET` длиной не менее 32 символов и настроить `DATABASE_URL`. Порт по умолчанию — `3001`.

```bash
bun run typecheck
bun test
```

Unit-тесты не требуют PostgreSQL. Миграция и интеграционные auth-сценарии требуют запущенной БД.

## Структура

- `index.ts` — запуск Bun HTTP-сервера.
- `src/app.ts` — приложение Hono, маршруты и обработка ошибок.
- `src/config.ts` — Zod-валидация переменных окружения.
- `src/db/index.ts` — подключение PostgreSQL.
- `src/db/migrate.ts` — применение SQL-миграции.
- `src/db/migrations/001_auth.sql` — таблицы `users` и `auth_sessions`.
- `src/auth/password.ts` — Argon2id hash/verify.
- `src/auth/tokens.ts` — access JWT, opaque refresh tokens и их хеши.
- `src/auth/service.ts` — регистрация, вход, rotation, logout и текущий пользователь.
- `src/auth/middleware.ts` — Bearer token и `requireAuth`.
- `src/auth/routes.ts` — HTTP endpoints.
- `src/auth/schemas.ts` — схемы запросов.
- `tests/auth.test.ts` — unit-тесты паролей и токенов.

## Модель данных

### `users`

Хранит `id`, нормализованный `email`, `password_hash`, `name` и timestamps. Уникальность email обеспечивается индексом по `lower(email)`.

### `auth_sessions`

Хранит `id`, `user_id`, только SHA-256-хеш refresh token, `expires_at`, `revoked_at`, причину отзыва и timestamps. Исходный refresh token в БД не сохраняется.

## Auth API

| Метод | Endpoint | Назначение |
| --- | --- | --- |
| `POST` | `/auth/register` | Создать пользователя и сессию |
| `POST` | `/auth/login` | Проверить пароль и создать сессию |
| `POST` | `/auth/refresh` | Выполнить rotation и выдать новую пару токенов |
| `POST` | `/auth/logout` | Отозвать сессию |
| `GET` | `/me` | Вернуть пользователя по Bearer access token |
| `GET` | `/health` | Health check |

Успешные register/login/refresh ответы предназначены для Next.js server-to-server и содержат `accessToken`, `refreshToken`, сроки действия и безопасный объект `user`. `/me` возвращает `{ user }`.

## Правила токенов и сессий

- Access token — JWT HS256 со claims `sub`, `sid`, `jti`, `iat`, `exp`, `iss`, `aud`.
- При проверке JWT учитываются подпись, алгоритм, issuer, audience и срок действия.
- Refresh token имеет формат `<session UUID>.<random secret>`; секрет генерируется криптографически.
- Каждый refresh атомарно блокирует строку сессии и заменяет текущий refresh token.
- Несовпадение хеша для существующей активной сессии считается replay: сессия отзывается.
- Logout идемпотентен и не раскрывает валидность переданной сессии.
- `requireAuth`/`/me` проверяют не только JWT, но и существование активной, неотозванной и неистёкшей сессии.

## Обязательные инварианты

- Не возвращать password hash, refresh token или access token в `/me`.
- Не логировать пароли и токены.
- Не передавать auth-ответы Bun напрямую в браузер: cookie создаёт Next.js.
- Все новые endpoints валидировать через Zod; ошибки возвращать как `{ error: { code, message } }`.
- Ошибки входа не должны раскрывать, существует ли email.
- Приватные документы в дальнейшем проверять по ACL на backend, а не только по наличию JWT.
- Документы, Yjs, WebSocket, realtime ticket и Redis пока не реализованы в этой части проекта.
