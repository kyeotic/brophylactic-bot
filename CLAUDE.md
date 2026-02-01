# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Discord bot for gaming/gambling features (Sardines lottery, Roulette, dice rolling, guessing games). Built with TypeScript, deployed as AWS Lambda functions, uses Firebase/Firestore for persistence.

## Commands

```bash
npm start          # Run bot locally via gateway (npx tsx src/bot.ts)
npm run build      # Full build: tsc → esbuild → zip for Lambda
npm run check      # Run prettier + eslint
npm run style      # Format with prettier
npm run lint       # ESLint
```

No test framework is configured. The `test/` directory contains only shell script fixtures.

## Architecture

**Entry points:**
- `src/bot.ts` — Local dev: connects via Discord WebSocket gateway
- `src/api.ts` — Production: AWS Lambda HTTP handler for Discord interactions
- `src/workflow.ts` — Lambda handler for async game workflows (Step Functions)
- `src/lambda.ts` — Aggregates Lambda exports (`api` and `workflow`)

**Dependency injection:** `src/di.ts` creates an `AppContext` with config, logger, Discord client, Firebase client, user store, game stores, and workflow client. All command handlers receive this context.

**Interaction routing:** `src/discord/main.ts` is the central router that dispatches slash commands and button interactions to the appropriate handler.

**Command registration:** `src/commands/mod.ts` is the command registry. Game-specific commands live in `src/sardines/command.ts` and `src/roulette/command.ts`.

**Game pattern:** Both Sardines and Roulette follow the same structure: `command.ts` (Discord handler), `store.ts` (Firestore persistence), `types.ts` (type definitions), and a main logic file. Roulette uses AWS Step Functions for delayed completion.

**Firebase client:** Custom HTTP-based Firestore client in `src/firebase/` (not the Firebase SDK). Handles JWT auth, document CRUD, and Firestore value conversion.

## Code Style

- Prettier: 2 spaces, no semicolons, single quotes, 100 char width
- ESLint: TypeScript plugin with relaxed rules (allows `any`, console)
- Target: ES2020, CommonJS modules
- Path aliases: bare imports resolve to `src/` and `types/`

## Environment

Required env vars are listed in `.env.example`. Key ones: `BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `FIREBASE_64` (base64-encoded service account JSON), `DISCORD_SERVER_ID`, `stepFunctionArn`.
