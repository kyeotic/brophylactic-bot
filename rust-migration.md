# Rust Migration Plan

This plan tracks and explains the migration from typescript to rust.

This plan is the authoritative record of progress on the migration. When a phase is finished check the box, notify the user, and offer to clear the conversation and continue on the next phase.

If the user asks for adjustments to the plan EDIT THIS DOCUMENT.

The original Typescript source code is in src-ts/ if you need to reference it.

## Progress

- [x] Phase 1: Project Scaffolding & Bot Connection
- [x] Phase 2: Firestore Client
- [x] Phase 3: Core Types & Utilities
- [x] Phase 4: User Store & Reputation
- [x] Phase 5: Simple Commands (roll, bgr, guess, debug)
- [x] Phase 6: Game Infrastructure (Lottery, Job Queue)
- [x] Phase 7: Roulette
- [x] Phase 8: Sardines
- [ ] Phase 9: HTTP Server Entrypoint (Deferred)

---

## Phase 1: Project Scaffolding & Bot Connection

- Initialize Cargo project with directory structure mirroring current layout
- Set up dependencies: `serenity`, `poise`, `tokio`, `serde`, `tracing`
- Config module: load env vars (`dotenvy`), match current config shape
- Logger: `tracing` + `tracing-subscriber` (Rust equivalent of pino)
- Minimal bot that connects to Discord gateway and responds to a ping
- Command registration framework via poise

### Target directory structure

```
src/
  main.rs              # Bot entrypoint (gateway)
  config.rs            # Environment/config loading
  context.rs           # AppContext (shared state via poise Data)
  commands/
    mod.rs
    roll.rs
    bgr.rs
    guess.rs
    debug.rs
  discord/
    mod.rs
    helpers.rs         # message(), messageButton(), mention(), bgrLabel()
  firebase/
    mod.rs
    client.rs          # Firestore wrapper
  roulette/
    mod.rs
    command.rs
    roulette.rs
    store.rs
    types.rs
  sardines/
    mod.rs
    command.rs
    sardines.rs
    lottery.rs
    store.rs
    types.rs
  games/
    mod.rs
    lottery.rs
    dice.rs
    cards.rs
  jobs/
    mod.rs
    queue.rs
    types.rs
  users/
    mod.rs
    store.rs
  util/
    mod.rs
    random.rs
    dates.rs
    math.rs
```

## Phase 2: Firestore Client

- Use the `firestore` crate (abdolence/firestore-rs) — gRPC-based, mature, full feature support
- Supports: document CRUD, listing, transactions, field transforms (increment), serde integration
- Set up service account auth (the crate handles this via `gcloud-sdk`)
- Document conversion is handled by serde derive macros (no manual conversion like TS `convert.ts`)
- Wrap in a thin application-specific client if needed for ergonomics

## Phase 3: Core Types & Utilities

- `GuildMember` struct (id, guild_id, username, joined_at)
- Dice rolling: parse notation like "3d6", return roll results (`src/games/dice.rs`)
- Card definitions: ranks, suits, poker deck (`src/games/cards.rs`)
- Random utilities: seeded RNG via `rand` + `rand_chacha` for deterministic daily values
- Date utilities: `chrono` + `chrono-tz` for timezone-aware "is today" / "day string" checks
- Error types: custom error enum with `thiserror`, `anyhow` for handler-level errors

## Phase 4: User Store & Reputation

- `User` document struct with serde (id, name, last_guess_date, last_sardines_date, reputation_offset)
- `UserStore` operations:
  - `get_user(member)` — fetch or initialize
  - `get_user_rep(member)` — base rep from join date (days since join) + offset
  - `increment_user_rep(member, offset)` — Firestore field transform increment
  - `increment_user_reps(updates)` — batch increment
  - `get/set_user_last_guess(member)` — daily guess tracking
  - `get/set_user_last_sardines(member)` — daily sardines tracking
- Document ID format: `"{guild_id}.{user_id}"`

## Phase 5: Simple Commands

### `/roll`
- Options: `dice` (String, optional), `verbose` (Boolean, optional), `private` (Boolean, optional)
- Parse dice notation via regex: `/^(\d+)d(\d+)$/`
- Return total or individual rolls

### `/bgr`
- Subcommand `view`: display user's reputation (public/private flag)
- Subcommand `send`: transfer reputation to another user
  - Options: `to` (User, required), `amount` (Integer, required)
  - Validate sufficient balance
  - Use `increment_user_reps` for atomic transfer

### `/guess`
- Option: `number` (Integer, required, 1-100)
- One guess per day (timezone-aware via `chrono-tz`, "America/Los_Angeles")
- Seeded RNG: seed = bot_token + username + day_string
- Rewards: exact match (1000), magic pair adds to 101 (250), within 3 (30), last digit match (10)

### `/debug`
- Slash command returns message with a button
- Button interaction updates message with random value
- Demonstrates poise's component interaction handling

## Phase 6: Game Infrastructure

### Lottery base
- `Lottery<Player>` struct: id (nanoid), bet, creator, players, start_time, winner
- `can_finish()` — requires > 1 player
- `finish()` — random winner selection, payout calculation (winner: bet * (n-1), losers: -bet)
- Serialization for Firestore persistence

### Job Queue
- Polling-based queue backed by Firestore `jobs` collection
- Job document: id, type, payload, execute_at, status (pending/running/failed)
- `enqueue(type, payload, delay_seconds)` — create job with future execution time
- `process_due_jobs()` — poll every 5 seconds, execute overdue jobs
- Handler registration: map job type string to async handler function
- On startup: process any pending jobs for recovery
- Currently only used for `roulette:finish`

## Phase 7: Roulette

- `/roulette` command with `bet` option (Integer, required)
- Game flow:
  1. Creator pays bet immediately via `increment_user_rep`
  2. Game stored in Firestore `lotteries` collection
  3. Job enqueued: `roulette:finish` with 30-second delay
  4. Countdown updates message every 5 seconds via serenity HTTP client
  5. Players join via button interaction, each pays bet
  6. On finish: random winner gets full pot, game deleted from Firestore
- Minimum 2 players required (otherwise cancelled/refunded)
- Recovery: on startup, check for pending `roulette:finish` jobs and restart countdowns
- Message component type: "ROULETTE" (custom_id format: "ROULETTE:{game_id}")

## Phase 8: Sardines

- `/sardines` command with `bet` option (Integer, required)
- Game flow:
  1. Creator pays bet, one game per day limit
  2. Players join via button (no time limit)
  3. Each join has chance to end game: `failure_chance(n) = 1 - (0.4 - n + 0.3) / (n + 1.8) - 1`
  4. On failure: joiner is the "loser" (still pays bet)
  5. Winner selected randomly from existing players
  6. Payout multiplier: weighted random from [1.2, 1.5, 1.8, 2.0, 2.5]
  7. Pot = bet * (players + 1, including loser), winner gets pot * multiplier
- Minimum 4 players before creator can rejoin (1 in dev)
- Message component type: "SARDINES" (custom_id format: "SARDINES:{game_id}")

## Phase 9: HTTP Server Entrypoint (Deferred)

- `axum` or `actix-web` server receiving Discord webhook POSTs on port 8006
- ed25519 signature verification (`ed25519-dalek` crate)
- Health check endpoint: `GET /health`
- Shared interaction routing with bot entrypoint
- Same `AppContext` / poise data

---

## Key Crate Choices

| Concern                          | Crate                                |
| -------------------------------- | ------------------------------------ |
| Discord                          | `serenity` 0.12 + `poise` 0.6        |
| Firestore                        | `firestore` (abdolence/firestore-rs) |
| Async runtime                    | `tokio`                              |
| Serialization                    | `serde` + `serde_json`               |
| Logging                          | `tracing` + `tracing-subscriber`     |
| Date/time                        | `chrono` + `chrono-tz`               |
| RNG                              | `rand` + `rand_chacha` (seedable)    |
| Env config                       | `dotenvy`                            |
| Error handling                   | `thiserror` + `anyhow`               |
| ID generation                    | `nanoid`                             |
| Regex                            | `regex` (for dice parsing)           |
| HTTP server (Phase 9)            | `axum`                               |
| Signature verification (Phase 9) | `ed25519-dalek`                      |
