# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Discord bot for gaming/gambling features (Sardines lottery, Roulette, dice rolling, guessing games). Built with Rust using the poise/serenity framework, runs as a long-running Docker container, uses Firestore for persistence and job scheduling.

## Commands

```bash
just dev           # Run locally with .env.dev vars (cargo run)
just build         # Release build (cargo build --release)
just check         # Check compilation (cargo check)
just test          # Run tests (cargo test)
just lint          # Clippy lints with -D warnings
just fmt           # Format code (cargo fmt)
just fmt-check     # Check formatting without modifying
just deploy        # Build Docker image and push + stack-sync
```

## Architecture

**Framework:** Uses [poise](https://docs.rs/poise) (built on serenity 0.12) for Discord bot framework. Commands are defined with `#[poise::command]` macros. The bot connects via Discord WebSocket gateway.

**Application context:** `src/context.rs` defines `AppContext` (holds Config, FirestoreDb, Http, UserStore, JobQueue) and the poise `Context<'a>` type alias. All command handlers receive this context.

**Command registration:** `src/commands/mod.rs` collects all commands via `all()`. Commands: debug, roll, rep (reputation), guess, roulette, sardines.

**Game pattern:** Both Sardines and Roulette follow the same module structure: `command.rs` (poise command handler + button interaction handler), `store.rs` (Firestore persistence), and a main logic file (`sardines.rs`/`roulette.rs`). Roulette uses the job queue for delayed completion.

**Button interactions:** Handled via `event_handler` in `src/main.rs` which matches on component `custom_id` prefixes (DEBUG, ROULETTE, SARDINES). Custom IDs are encoded as `TYPE:id` via `discord::helpers`.

**Job queue:** `src/jobs/queue.rs` — polling-based job queue backed by Firestore `jobs` collection. Jobs are enqueued with a delay, polled at intervals, and executed when due. Handlers are registered by job type string.

**Firebase/Firestore:** Uses the `firestore` crate (not the Firebase SDK). Client initialized in `src/firebase/client.rs` from a base64-encoded service account JSON (`FIREBASE_64` env var). Firestore documents use `#[serde(rename_all = "camelCase")]` and `firestore::serialize_as_timestamp` for date fields.

**User system:** `src/users/store.rs` — users are identified by `{guild_id}.{user_id}` document IDs. Reputation is calculated from guild join date + stored offset. Reputation changes use Firestore transactions for atomicity.

**Discord helpers:** `src/discord/helpers.rs` provides response builders, mention formatting, BGR (reputation) labels, and `GuildMember` conversion from serenity types.

## Key Dependencies

- `poise` 0.6 / `serenity` 0.12 — Discord framework
- `firestore` 0.47 / `gcloud-sdk` — Firestore client
- `tokio` — async runtime
- `tracing` / `tracing-subscriber` — structured logging
- `chrono` / `chrono-humanize` / `chrono-tz` — date/time handling
- `anyhow` / `thiserror` — error handling

## Deployment

Docker image built via `just deploy`, pushed to `docker.local.kye.dev/discord-bot:latest`. Uses cargo-chef + sccache for cached builds. Deployed to homelab via stack-sync, publicly accessible through Cloudflare tunnel.

## Environment

Required env vars: `BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_SERVER_ID`, `FIREBASE_64` (base64-encoded service account JSON). Optional: `LOG_LEVEL` (default: info), `stage` (default: dev).
