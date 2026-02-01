# Docker Refactor Plan

## Goal

Migrate from AWS Lambda + Step Functions to a long-running Docker container deployed on a homelab via Portainer, with public access through a Cloudflare tunnel.

## Current Architecture

- **HTTP entry**: Lambda (`src/api.ts`) behind API Gateway, handles Discord interaction webhooks
- **Gateway entry**: `src/bot.ts` for local dev via Discord WebSocket
- **Async work**: Step Functions triggers `src/workflow.ts` after a 30-second delay to finish roulette games
- **Persistence**: Firestore via custom REST client (no SDK dependency)
- **Build**: TypeScript → esbuild bundle → zip for Lambda upload

## Target Architecture

A single long-running Node.js process that:

1. Runs an HTTP server to receive Discord interaction webhooks (replacing Lambda + API Gateway)
2. Uses a Firestore-backed job queue for delayed task execution (replacing Step Functions)
3. Runs in Docker, deployed to `docker.local.kye.dev` private registry
4. Publicly accessible via Cloudflare tunnel pointed at the HTTP server

### Why HTTP webhooks over Gateway

The current production setup uses HTTP interaction webhooks (not gateway). Keeping this model means Discord sends interactions to our HTTP endpoint, which is simpler and doesn't require gateway intents or WebSocket management. The gateway entry point (`src/bot.ts`) can remain for local development.

---

## Phase 1: Firestore Enhancements

### 1.1 Add `listDocuments` to Firestore client

**File:** `src/firebase/firestore.ts`

Add a `listDocuments()` method that calls `GET documents/{collection}` and returns all documents in the collection. The Firestore REST API returns `{ documents: [{ name: "...", fields: {...} }] }`. Parse the `name` field to extract the document ID.

**File:** `src/firebase/types.ts` — ensure `Document` type includes `name?: string`.

---

## Phase 2: Firestore-Backed Job Queue

### 2.1 Job types

**New file:** `src/jobs/types.ts`

```typescript
interface Job<T = unknown> {
  id: string
  type: string         // discriminator, e.g. 'roulette:finish'
  payload: T
  executeAt: string    // ISO date string
  status: 'pending' | 'running' | 'failed'
}

type JobHandler = (payload: unknown) => Promise<void>
```

### 2.2 JobQueue class

**New file:** `src/jobs/queue.ts`

Generic `JobQueue` class backed by a Firestore `jobs` collection:

- `register(type, handler)` — register a handler function for a job type
- `enqueue(type, payload, delaySeconds)` — create a job doc in Firestore with `executeAt = now + delay`
- `start(pollIntervalMs)` — begin polling loop; immediately process any overdue jobs on first tick (startup recovery)
- `stop()` — clear polling interval (for graceful shutdown)
- `processDueJobs()` — call `listDocuments()`, filter for `status === 'pending'` and `executeAt <= now`, execute each
- `executeJob(job)` — set status to `running`, call registered handler, delete doc on success, set `failed` on error

This replaces both the Step Functions workflow client AND the orphan recovery concept — the job queue handles both.

### 2.3 Wire into DI and roulette

**File:** `src/di.ts` — replace `workflow: WorkflowClient` with `jobQueue: JobQueue` in `AppContext`.

**File:** `src/roulette/roulette.ts` — in `start()`, replace:
```typescript
await this.context.workflow.startRoulette({ id, interaction, duration })
```
with:
```typescript
await this.context.jobQueue.enqueue('roulette:finish', { id, interaction }, rouletteTimeSeconds)
```

---

## Phase 3: Replace Logger with pino

**File:** `src/util/logger.ts` — rewrite to use `pino`. Existing call sites use `.info()`, `.error()`, `.debug()`, `.warn()` which are all pino-compatible, so no caller changes needed.

**File:** `src/di.ts` — update `AppLogger` type to `pino.Logger`.

**package.json** — add `pino`, `pino-pretty` (dev); remove `lambda-logger-node`.

---

## Phase 4: HTTP Server

### 4.1 Create HTTP server entry point

**New file:** `src/server.ts`

- Node `http.createServer` on configurable port (default 8006)
- `POST /` — verify Discord signature (reuse tweetnacl logic from `src/api.ts`), parse body, route through `src/discord/main.ts`, return JSON response
- `GET /health` — return 200
- On startup: init context, register `roulette:finish` job handler (calls `finishRoulette`), start job queue polling
- Graceful shutdown on `SIGTERM`/`SIGINT`: stop job queue, close server

### 4.2 Remove Lambda handler

**Delete:** `src/api.ts` — logic migrated into `src/server.ts`

---

## Phase 5: Remove AWS Dependencies

- Delete `src/workflow/client.ts` (AWS Step Functions client)
- Delete `src/workflow.ts` (Lambda workflow handler)
- Delete `src/lambda.ts` (Lambda export aggregator)
- Remove `aws4`, `@types/aws-lambda`, `@types/aws4` from `package.json`
- Remove `stepFunctionArn`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` from `src/config.ts`

---

## Phase 6: Build & Docker

### 6.1 Update build scripts

**File:** `esbuild.js` — change entry point from `src/lambda.ts` to `src/server.ts`.

**File:** `package.json` scripts:
- `"start:server": "npx tsx src/server"` — local HTTP dev
- `"build"` — keep esbuild bundle, remove zip step
- Remove `build:package` zip step

### 6.2 Dockerfile

```dockerfile
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json esbuild.js ./
COPY src/ src/
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=build /app/dist/server.js ./dist/
EXPOSE 8006
CMD ["node", "dist/server.js"]
```

### 6.3 docker-compose.yaml

```yaml
services:
  bot:
    image: docker.local.kye.dev/brophylactic-bot:latest
    container_name: brophylactic-bot
    restart: unless-stopped
    ports:
      - '8006:8006'
    labels:
      - 'stook=redeploy'
    environment:
      - BOT_TOKEN=${BOT_TOKEN:?err}
      - DISCORD_PUBLIC_KEY=${DISCORD_PUBLIC_KEY:?err}
      - DISCORD_SERVER_ID=${DISCORD_SERVER_ID:?err}
      - FIREBASE_64=${FIREBASE_64:?err}
      - NODE_ENV=production
      - LOG_LEVEL=${LOG_LEVEL:-info}
```

### 6.4 justfile

```just
deploy:
  docker build --platform linux/amd64 -t docker.local.kye.dev/brophylactic-bot:latest .
  docker push docker.local.kye.dev/brophylactic-bot:latest
```

---

## Phase 7: Cleanup

- Update `.env.example` — remove AWS vars, add `LOG_LEVEL`
- Update `CLAUDE.md` — reflect new architecture, entry points, deployment process

---

## Files Summary

| Action | File |
|--------|------|
| Create | `src/jobs/types.ts`, `src/jobs/queue.ts` |
| Create | `src/server.ts` |
| Create | `Dockerfile`, `docker-compose.yaml`, `justfile` |
| Modify | `src/firebase/firestore.ts`, `src/firebase/types.ts` |
| Modify | `src/util/logger.ts` |
| Modify | `src/di.ts`, `src/config.ts` |
| Modify | `src/roulette/roulette.ts` |
| Modify | `package.json`, `esbuild.js`, `.env.example`, `CLAUDE.md` |
| Delete | `src/lambda.ts`, `src/api.ts`, `src/workflow.ts`, `src/workflow/client.ts` |

---

## Verification

1. `npm run check` — prettier + eslint pass
2. `npm run build` — esbuild produces `dist/server.js`
3. `npm run start:server` — server starts, responds to `GET /health` with 200
4. `npm start` — gateway mode still works for local dev
5. `docker build .` — image builds successfully
6. Manual test: trigger `/roulette`, verify job appears in Firestore `jobs` collection, completes after 30s
