# Code Review Implementation Checklist

## main.rs

- [x] Extract the `setup` closure into a dedicated function (e.g., `async fn build_app_context(...)`) to reduce main() size and indentation
- [x] Replace `"roulette:finish"` string in `job_queue.register` with an enum; consider a trait to associate payload types with job variants
- [x] Move `job_queue` poll interval (`5000`) into `Config`
- [x] Move `recover_countdowns` out of main — make it a method on Roulette or a startup hook on the job queue
- [x] Replace `parse_custom_id` string matching with an `InteractionType` enum (`FromStr` or `TryFrom<&str>`)

## config.rs

- [x] `stage` usage — it's only checked in `min_players_before_rejoin` and the startup log. Remove it and move the min players to config
- [x] Add `job_queue_poll_interval_ms` to Config
- [x] Add `min_players_before_rejoin` to Config (currently hardcoded in sardines)
- [x] Parse timezone into `chrono_tz::Tz` once in `Config::load` instead of re-parsing from string in every date function call
- [x] Add a dedicated `random_seed`/`salt` field to Config (replaces bot token as seed — see sardines entry)

## util/dates.rs

- [x] Replace `get_day_string` manual formatting with `zoned.format("%Y-%m-%d").to_string()`
- [x] Update `is_today` and `get_day_string` to accept `Tz` instead of `&str` (after Config change above)
- [x] Remove `.expect("Invalid timezone")` panic paths (handled by Config parsing)

## users/store.rs

- [x] Refactor `increment_user_reps` to use Firestore field-level update (`.fields(paths!(User::reputation_offset))`) instead of reconstructing the full `User` struct
- [x] Extract common Firestore fluent API patterns into a generic store trait or helper (`get_by_id`, `upsert`, `delete`)

## sardines/command.rs

- [ ] Replace `to_guild_member` free function with `GuildMember::from_serenity(guild_id, user, joined_at)` constructor
- [ ] Break up `handle_sardines_join` — extract validation logic, response building, etc.

## sardines/sardines.rs

- [x] Move `min_players_before_rejoin` threshold into Config (remove function)
- [ ] Rewrite `join_failure_chance` comment to describe the curve behavior (low chance at few players, approaching 100% asymptotically) instead of showing TS algebraic derivation
- [ ] Change `Sardines::init` and `Sardines::load` to take `FirestoreDb` by value (or document the clone) — don't hide ownership behind `&`
- [ ] `Sardines.load`: have it take all needed dependencies at load time rather than some at init and some later
- [x] Stop using bot token as random seed — use the new `Config.random_seed` field instead
- [ ] Extract "pick a seeded-random element from a slice" into a utility function in `util/random.rs`
- [ ] Rewrite `finish` result message (line 212) to pre-allocate variables and use inline format style
- [ ] Verify `pot_size` (+1 for loser) is intentional and add a clarifying comment

## roulette/command.rs

- [ ] Break up `roulette` command — separate game logic from display/message building
- [ ] Break up `handle_roulette_join` similarly
- [ ] **Fix double-charge bug**: players are charged on join AND again by `Lottery::finish` payouts. Either remove join-time deduction and rely solely on `Lottery::finish` payouts, or keep join-time deduction and adjust finish to only pay the winner (not re-charge losers)

## roulette/roulette.rs

- [ ] Same `init`/`load` ownership fix as sardines — take `FirestoreDb` by value

## games/lottery.rs

- [ ] Rename `StoredPlayer` to something more descriptive (`PersistedPlayer`, `SerializedPlayer`, `DbPlayer`, etc.)
- [ ] Delete `from_parts` — it's genuinely dead code (deserialization goes through serde, not this constructor)

## games/dice.rs

- [ ] No changes needed — regex for simple "NdX" parsing is fine

## discord/helpers.rs

- [ ] Remove `message()` and `message_with_button()` dead code (or gate behind a feature flag if HTTP gateway is planned)
- [ ] `to_guild_member` replaced by `GuildMember::from_serenity` (see sardines/command.rs entry)

## commands/ (module organization)

- [ ] Restructure: create a single `commands.rs` in `src/` that collects all commands via thin mappings
- [ ] Move `guess` and `roll` handlers into `games/`
- [ ] Find a home for `bgr` and `debug` (either their own modules or a `misc/` / `admin/` grouping)

## jobs/queue.rs

- [ ] Replace job type `String` with an enum (same enum as main.rs registration)
- [ ] Replace job status `String` ("pending"/"running"/"failed") with a `#[derive(Serialize, Deserialize)]` enum
- [ ] Address lack of graceful shutdown — wire up `JobQueue::stop()` to bot disconnect/signal handling

## sardines/store.rs

- [ ] Fix `set_players` race condition — wrap the read-modify-write in a Firestore transaction (like `increment_user_reps` does)

## roulette countdown

- [ ] Consider replacing per-tick Firestore reads in `start_countdown` with in-memory shared state, or skip player list updates in countdown ticks

## Format style (applies globally)

- [ ] Prefer `format!("name {name}")` inline style over `format!("name {}", name)` unless heavy pre-allocation is needed (3+ computed values)
