# CodeLink Backend

Production-oriented Express + Prisma backend for the existing CodeLink frontend. It keeps the frontend contract intact while adding cookie auth, PostgreSQL models, session chat, Socket.io, and safe mock code execution.

## Folder Structure

```text
backend/
  prisma/
    migrations/
    schema.prisma
  scripts/
    seed-users.ts
  services/
    code-execution/
  src/
    config/
    lib/
    middleware/
    routes/
    services/
    socket/
    types/
    app.ts
    server.ts
  .env.example
```

## Requirements

- Node.js 22+
- PostgreSQL running locally or remotely

## Environment

Copy `.env.example` to `.env` and update the database URL if needed.

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/codelink?schema=public
PORT=4000
CORS_ORIGIN=http://localhost:3000
SESSION_COOKIE_NAME=codelink_session
SESSION_TTL_DAYS=30
NODE_ENV=development
```

## Install

```bash
npm install
```

## Database

```bash
npm run db:generate
npm run db:migrate
npm run seed:users
```

## Run

```bash
npm run dev
```

Optional standalone mock code runner:

```bash
npm run dev:runner
```

## Frontend Compatibility

- All REST endpoints live under `/api/*`
- Auth uses HTTP-only cookies
- Enum values are normalized to lowercase in JSON responses
- `studentId: "pending"` is treated as `null` on session creation
- `/api/run-code` returns the exact result shape expected by the frontend

## Socket.io Events

- Rooms use the format `session:<sessionId>`
- `join-session` with `{ sessionId }`
- `send-message` with `{ sessionId, content }`
- `typing-start` with `{ sessionId }`
- `typing-stop` with `{ sessionId }`
- `receive-message` server event with the frontend `Message` shape
- `user-joined`, `user-left`, `typing-start`, and `typing-stop` are broadcast to the other participant in the session room
