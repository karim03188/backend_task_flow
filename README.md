# Task Flow — Backend API

Production-minded REST backend for the **Task Flow** Flutter application, built
with **NestJS 12 + TypeScript**, **Prisma** and a **SQLite** database for local
development. Authentication uses JWT access tokens with real server-side
revocation.

> **Database note.** The original brief asked for PostgreSQL + Docker Compose.
> Docker is not available in this environment and a zero-dependency local
> database was explicitly requested, so the default datasource is **SQLite**
> (`file:./dev.db`). The schema is portable; see
> [Switching to PostgreSQL](#switching-to-postgresql). A ready-to-use
> `docker-compose.yml` is included for teams that prefer PostgreSQL.

---

## 1. Tech stack

| Concern          | Choice                                             |
| ---------------- | -------------------------------------------------- |
| Framework        | NestJS 12 (TypeScript, CommonJS)                   |
| Database         | SQLite (dev/test) · PostgreSQL 16 (optional, Docker) |
| ORM              | Prisma 6 (`prisma-client-js`)                       |
| Auth             | JWT (`@nestjs/jwt`) + bcrypt password hashing (`bcryptjs`) |
| Validation       | `class-validator` + `class-transformer`            |
| Docs             | Swagger / OpenAPI at `/api/docs`                   |
| Config           | `@nestjs/config` + startup env validation          |
| Security         | Helmet, CORS, rate limiting (`@nestjs/throttler`)  |
| Tests            | Jest + Supertest (unit + e2e)                      |

---

## 2. Project structure

```
backend/
├─ prisma/
│  ├─ schema.prisma          # User, Category, Task models
│  ├─ migrations/            # versioned migrations
│  └─ seed.ts                # development seed data
├─ api/
│  └─ task-flow.http         # ready-to-run HTTP request collection
├─ src/
│  ├─ main.ts                # entrypoint
│  ├─ bootstrap.ts           # prefix, helmet, CORS, Swagger, shutdown
│  ├─ app.module.ts          # wiring + global providers (pipe/guard/filter/interceptor)
│  ├─ config/                # configuration + env validation
│  ├─ prisma/                # PrismaModule + PrismaService
│  ├─ common/                # filters, interceptors, guards, decorators, DTOs, utils
│  ├─ auth/                  # auth controller/service, JWT guard, DTOs
│  ├─ users/                 # profile + password endpoints
│  ├─ tasks/                 # task CRUD, filtering, pagination
│  ├─ categories/            # category management
│  ├─ statistics/            # dashboard overview
│  └─ health/                # health check
└─ test/                     # e2e tests, helpers, test DB setup
```

---

## 3. Prerequisites

- **Node.js 24+** (built on Node 24.14; Jest needs 24.9+ for native ESM)
- **npm 11+**
- No database server required — SQLite is embedded.
- (Optional) **Docker** only if you choose PostgreSQL.

---

## 4. Quick start

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Create your env file
cp .env.example .env
#    then set a strong JWT_SECRET:
#    node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 3. Generate the Prisma client, create the database and apply migrations
npm run prisma:generate
npm run prisma:migrate        # prisma migrate dev (creates prisma/dev.db)

# 4. Seed demo data (optional but recommended)
npm run db:seed

# 5. Run the API
npm run start:dev
```

The API is now available at `http://localhost:3000/api/v1` and Swagger at
`http://localhost:3000/api/docs`.

**Seed credentials:** `demo@taskflow.dev` / `Password123`

---

## 5. Environment variables

All variables are validated at startup (`src/config/env.validation.ts`); the app
refuses to boot with invalid configuration. See `.env.example`.

| Variable         | Required | Default       | Description                                             |
| ---------------- | -------- | ------------- | ------------------------------------------------------- |
| `NODE_ENV`       | no       | `development` | `development` \| `test` \| `production`                 |
| `PORT`           | no       | `3000`        | HTTP port                                               |
| `DATABASE_URL`   | **yes**  | —             | e.g. `file:./dev.db` (path relative to `prisma/`)       |
| `JWT_SECRET`     | **yes**  | —             | ≥ 16 chars. Never commit a real value.                  |
| `JWT_EXPIRES_IN` | no       | `7d`          | Access token lifetime                                   |
| `CORS_ORIGIN`    | no       | `*`           | Comma-separated allowed origins, or `*` (dev only)      |
| `THROTTLE_TTL`   | no       | `60`          | Rate-limit window in seconds                            |
| `THROTTLE_LIMIT` | no       | `10`          | Max requests per window (auth endpoints are stricter)   |

> `.env` is git-ignored. Only `.env.example` (with placeholders) is committed.

---

## 6. Database: migrations, seed, reset

```bash
npm run prisma:generate        # generate the Prisma client
npm run prisma:validate        # validate the schema
npm run prisma:migrate         # create + apply a migration (dev)
npm run prisma:migrate:deploy  # apply migrations (CI/production)
npm run db:seed                # run prisma/seed.ts
npm run prisma:reset           # drop, re-create and re-seed the dev database
npm run prisma:studio          # open Prisma Studio
```

**Reset the development database** (destructive):

```bash
npm run prisma:reset
```

This deletes `prisma/dev.db`, re-applies migrations and runs the seed. It never
touches `prisma/test.db`, which the e2e suite owns.

---

## 7. API conventions

### Base URL and versioning

All routes are prefixed with **`/api/v1`**.

### Authentication

Send the JWT as a bearer token:

```
Authorization: Bearer <accessToken>
```

Tokens are returned by `POST /api/v1/auth/register` and `POST /api/v1/auth/login`.

**Token revocation is real.** Each JWT embeds the user's `tokenVersion`.
`POST /auth/logout` and changing the password increment that version on the
server, so every previously issued token is rejected with `401` even though it
has not expired. The client should still discard the token locally.

### Success envelope

```json
{
  "success": true,
  "data": { "...": "..." },
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

Paginated responses add `meta`:

```json
{
  "success": true,
  "data": [ { "...": "..." } ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

### Error envelope

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["title should not be empty"],
  "path": "/api/v1/tasks",
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

`message` is a string, or an array of strings for validation errors. Stack traces
and internal database errors are never returned.

### Status codes

`200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `429`.

### Dates

All timestamps are ISO 8601 UTC strings, e.g. `2026-01-31T17:00:00.000Z`.
Send `null` for `dueDate`/`categoryId` to clear them.

---

## 8. Endpoints

| Method | Path                             | Auth | Description                       |
| ------ | -------------------------------- | ---- | --------------------------------- |
| GET    | `/api/v1/health`                 | no   | Health / DB probe                 |
| POST   | `/api/v1/auth/register`          | no   | Register (returns token)          |
| POST   | `/api/v1/auth/login`             | no   | Log in (returns token)            |
| POST   | `/api/v1/auth/logout`            | yes  | Revoke all tokens                 |
| GET    | `/api/v1/auth/me`                | yes  | Current user                      |
| GET    | `/api/v1/users/me`               | yes  | Profile                           |
| PATCH  | `/api/v1/users/me`               | yes  | Update profile                    |
| PATCH  | `/api/v1/users/me/password`      | yes  | Change password (revokes tokens)  |
| POST   | `/api/v1/categories`             | yes  | Create category                   |
| GET    | `/api/v1/categories`             | yes  | List categories (+`taskCount`)    |
| GET    | `/api/v1/categories/:id`         | yes  | Get category                      |
| PATCH  | `/api/v1/categories/:id`         | yes  | Update category                   |
| DELETE | `/api/v1/categories/:id`         | yes  | Delete category (tasks kept)      |
| POST   | `/api/v1/tasks`                  | yes  | Create task                       |
| GET    | `/api/v1/tasks`                  | yes  | List / filter / search / paginate |
| GET    | `/api/v1/tasks/:id`              | yes  | Get task                          |
| PATCH  | `/api/v1/tasks/:id`              | yes  | Partially update task             |
| DELETE | `/api/v1/tasks/:id`              | yes  | Delete task (`204`)               |
| PATCH  | `/api/v1/tasks/:id/complete`     | yes  | Mark completed                    |
| PATCH  | `/api/v1/tasks/:id/reopen`       | yes  | Reopen (back to `TODO`)           |
| GET    | `/api/v1/statistics/overview`    | yes  | Dashboard metrics                 |

### Task query parameters

`GET /api/v1/tasks`

| Param         | Example                     | Notes                                            |
| ------------- | --------------------------- | ------------------------------------------------ |
| `status`      | `TODO`                      | `TODO` `IN_PROGRESS` `COMPLETED` `CANCELLED`     |
| `priority`    | `HIGH`                      | `LOW` `MEDIUM` `HIGH` `URGENT`                   |
| `categoryId`  | `cuid`                      | Filter by category                               |
| `search`      | `report`                    | Matches `title` and `description`                |
| `dueDateFrom` | `2026-01-01T00:00:00.000Z`  | ISO 8601                                         |
| `dueDateTo`   | `2026-12-31T23:59:59.999Z`  | ISO 8601                                         |
| `dueToday`    | `true`                      | Due within today                                 |
| `overdue`     | `true`                      | Past due and not completed/cancelled             |
| `sortBy`      | `createdAt`                 | `createdAt` `updatedAt` `dueDate` `priority` `title` |
| `sortOrder`   | `desc`                      | `asc` `desc`                                     |
| `page`        | `1`                         | 1-based                                          |
| `limit`       | `20`                        | 1–100                                            |

Filtering, searching, sorting and pagination all run in the database.

---

## 9. Sample requests & responses

### Register

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Jane Doe","email":"jane@example.com","password":"Password123"}'
```

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "cmv13w6kn0000khsrykdba2gx",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "createdAt": "2026-01-01T12:00:00.000Z",
      "updatedAt": "2026-01-01T12:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": "7d"
  },
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@taskflow.dev","password":"Password123"}'
```

### Create a task

```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"title":"Prepare sprint report","priority":"HIGH","dueDate":"2026-12-31T17:00:00.000Z"}'
```

```json
{
  "success": true,
  "data": {
    "id": "cmv13wj9h0004khsrnkew0r8s",
    "title": "Prepare sprint report",
    "description": null,
    "status": "TODO",
    "priority": "HIGH",
    "dueDate": "2026-12-31T17:00:00.000Z",
    "completedAt": null,
    "categoryId": null,
    "createdAt": "2026-01-01T12:00:00.000Z",
    "updatedAt": "2026-01-01T12:00:00.000Z"
  },
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

### Update a task (partial)

```bash
curl -X PATCH http://localhost:3000/api/v1/tasks/<id> \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"priority":"URGENT","dueDate":null}'
```

### List tasks

```bash
curl "http://localhost:3000/api/v1/tasks?status=TODO&sortBy=priority&sortOrder=desc&page=1&limit=20" \
  -H 'Authorization: Bearer <token>'
```

```json
{
  "success": true,
  "data": [ { "id": "...", "title": "...", "status": "TODO", "priority": "URGENT" } ],
  "meta": {
    "page": 1, "limit": 20, "total": 2,
    "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false
  },
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

### Statistics

```bash
curl http://localhost:3000/api/v1/statistics/overview -H 'Authorization: Bearer <token>'
```

```json
{
  "success": true,
  "data": {
    "totalTasks": 6,
    "completedTasks": 1,
    "pendingTasks": 4,
    "todoTasks": 3,
    "inProgressTasks": 1,
    "cancelledTasks": 1,
    "overdueTasks": 2,
    "dueTodayTasks": 1,
    "completionPercentage": 17,
    "byPriority": { "LOW": 2, "MEDIUM": 1, "HIGH": 1, "URGENT": 2 },
    "byStatus": { "TODO": 3, "IN_PROGRESS": 1, "COMPLETED": 1, "CANCELLED": 1 }
  },
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

A full, runnable collection of every request lives in
[`api/task-flow.http`](api/task-flow.http) — open it with the VS Code **REST
Client** extension or the IntelliJ/WebStorm HTTP client and click "Send
Request".

---

## 10. Connecting from the Flutter app

The backend speaks plain JSON with predictable field names, ISO 8601 dates, a
`Bearer` token and a consistent pagination `meta` object — a natural fit for
[Dio](https://pub.dev/packages/dio).

### Base URL depends on where the app runs

`localhost` inside an emulator/simulator/device is **not** your Mac.

| Client                 | Base URL                             |
| ---------------------- | ------------------------------------ |
| macOS host (Web/desktop, curl) | `http://localhost:3000/api/v1` |
| iOS simulator          | `http://localhost:3000/api/v1`       |
| Android emulator       | `http://10.0.2.2:3000/api/v1`        |
| Physical device        | `http://<MAC_LAN_IP>:3000/api/v1`    |

Find your Mac's LAN IP with `ipconfig getifaddr en0`. For a physical device,
make sure the Mac and phone are on the same Wi-Fi and that `CORS_ORIGIN` /
firewall allow the connection. Never hard-code `localhost` as the production
API address — inject the base URL per environment (e.g. `--dart-define`).

### Minimal Dio example

```dart
final dio = Dio(BaseOptions(
  baseUrl: 'http://10.0.2.2:3000/api/v1', // Android emulator
  headers: {'Content-Type': 'application/json'},
));

// Login
final res = await dio.post('/auth/login', data: {
  'email': 'demo@taskflow.dev',
  'password': 'Password123',
});
final token = res.data['data']['accessToken'] as String;

// Authenticated request
dio.options.headers['Authorization'] = 'Bearer $token';
final tasks = await dio.get('/tasks', queryParameters: {'page': 1, 'limit': 20});
final meta = tasks.data['meta']; // pagination metadata
```

### CORS

Set `CORS_ORIGIN` to a comma-separated allow-list in production, e.g.
`CORS_ORIGIN=https://app.taskflow.dev,https://admin.taskflow.dev`. Use `*` only
for local development.

---

## 11. Testing

```bash
npm test          # unit tests (Jest)
npm run test:e2e  # end-to-end tests (Jest + Supertest)
npm run test:cov  # unit tests with coverage
```

- **Isolation.** E2E tests run against a dedicated SQLite database,
  `prisma/test.db`, created from migrations by `test/global-setup.ts`. The
  development database `prisma/dev.db` is never touched. `NODE_ENV=test` is set
  before application import (`test/setup-env.ts`), and rate limiting is disabled
  for deterministic runs (`AppThrottlerGuard`).
- Coverage includes authentication (register/login/validation/hashing),
  protected-route access, task CRUD + complete/reopen + filters + sort +
  pagination, category management, cross-user isolation, statistics math and
  the health endpoint.

---

## 12. Security

- Passwords hashed with **bcrypt** (cost 12) via `bcryptjs`; hashes are never
  returned.
- Email addresses normalised (trimmed + lower-cased); duplicate emails → `409`.
- Global `JwtAuthGuard`; only `/health` and the auth register/login routes are
  public.
- Every task/category query is scoped by `userId` — one user can never read or
  mutate another user's data (returned as `404`, never `403`).
- Global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted` and
  transformation (mass-assignment protection).
- Helmet security headers; configurable CORS; rate limiting on auth endpoints.
- Centralised exception filter that never leaks stack traces or DB internals.
- Environment validated at startup; secrets only from the environment.

---

## 13. Switching to PostgreSQL

1. `docker compose up -d` (starts PostgreSQL on `localhost:5432`).
2. In `prisma/schema.prisma` set `provider = "postgresql"`.
3. Set in `.env`:
   `DATABASE_URL="postgresql://taskflow:taskflow@localhost:5432/taskflow?schema=public"`
4. Remove the SQLite migrations and create PostgreSQL ones:
   ```bash
   rm -rf prisma/migrations
   npx prisma migrate dev --name init
   ```
   With PostgreSQL you can additionally switch `status`/`priority` from `String`
   to native Prisma `enum`s (SQLite does not support enums, which is why they are
   validated with `class-validator` here).

---

## 14. Intentionally omitted

- **Refresh tokens.** The brief made refresh tokens optional. Access-token
  revocation is implemented server-side via `tokenVersion`; adding rotating
  refresh tokens would be the next step.
- **Task tags.** Explicitly optional. A `Tag` model is not included.
- **Roles / admin.** The brief only requires per-user ownership.

---

## 15. Verification performed

| Step                                            | Result                    |
| ----------------------------------------------- | ------------------------- |
| `npm run prisma:validate`                       | schema valid              |
| `npm run prisma:generate`                       | client generated          |
| `npm run prisma:migrate`                        | migration applied         |
| `npm run db:seed`                               | 1 user, 3 categories, 5 tasks |
| `npm run build`                                 | success                   |
| `npm run lint`                                  | no errors                 |
| `npm test`                                      | 7 passed                  |
| `npm run test:e2e`                              | 27 passed                 |
| `npm run start:dev` + live curl                 | health/auth/tasks/statistics OK |
| Swagger `/api/docs`                             | HTTP 200, all routes present |
