# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Discord bot for gaming/gambling features (Sardines lottery, Roulette, dice rolling, guessing games). Built with TypeScript, runs as a long-running Docker container, uses Firebase/Firestore for persistence and job scheduling.

## Commands

```bash
npm start          # Run bot locally via gateway (npx tsx src/bot.ts)
npm run start:server # Run HTTP server locally (npx tsx src/server.ts)
npm run build      # Full build: tsc → esbuild bundle
npm run check      # Run prettier + eslint
npm run style      # Format with prettier
npm run lint       # ESLint
just deploy        # Build and push Docker image
```

No test framework is configured. The `test/` directory contains only shell script fixtures.

## Architecture

**Entry points:**
- `src/bot.ts` — Local dev: connects via Discord WebSocket gateway
- `src/server.ts` — Production: HTTP server receiving Discord interaction webhooks, with Firestore-backed job queue for delayed tasks

**Dependency injection:** `src/di.ts` creates an `AppContext` with config, logger, Discord client, Firebase client, user store, game stores, and job queue. All command handlers receive this context.

**Interaction routing:** `src/discord/main.ts` is the central router that dispatches slash commands and button interactions to the appropriate handler.

**Command registration:** `src/commands/mod.ts` is the command registry. Game-specific commands live in `src/sardines/command.ts` and `src/roulette/command.ts`.

**Game pattern:** Both Sardines and Roulette follow the same structure: `command.ts` (Discord handler), `store.ts` (Firestore persistence), `types.ts` (type definitions), and a main logic file. Roulette uses a Firestore-backed job queue for delayed completion.

**Job queue:** `src/jobs/queue.ts` provides a polling-based job queue backed by a Firestore `jobs` collection. Jobs are enqueued with a delay and executed when due. Replaces AWS Step Functions.

**Firebase client:** Custom HTTP-based Firestore client in `src/firebase/` (not the Firebase SDK). Handles JWT auth, document CRUD, listing, and Firestore value conversion.

**Logging:** Uses `pino` for structured logging (`src/util/logger.ts`). Uses `pino-pretty` in development.

## Code Style

- Prettier: 2 spaces, no semicolons, single quotes, 100 char width
- ESLint: TypeScript plugin with relaxed rules (allows `any`, console)
- Target: ES2020, CommonJS modules
- Path aliases: bare imports resolve to `src/` and `types/`

## Deployment

Docker image built via `just deploy`, pushed to `docker.local.kye.dev/discord-bot:latest`. Deployed to homelab via Portainer, publicly accessible through Cloudflare tunnel.

## Environment

Required env vars are listed in `.env.example`. Key ones: `BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_SERVER_ID`, `FIREBASE_64` (base64-encoded service account JSON), `LOG_LEVEL`.
