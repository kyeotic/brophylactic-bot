# Discord Bot Framework Migration Options

Comparing alternatives to discordeno for a TypeScript (or Rust) Discord bot with these requirements:

1. Define slash commands once, get types for uploading and handling
2. Full Discord API coverage in types
3. Both gateway (bot) and HTTP (webhook) backends, easily switchable

---

## TypeScript Frameworks

### discordeno (current)

- **Slash commands:** No builder pattern. Raw API objects, manually registered. No type-level connection between command definitions and interaction handlers — option access is stringly-typed at runtime.
- **Type coverage:** Own types in `@discordeno/types`, reasonably complete but maintained independently from Discord's API changes.
- **Dual backend:** Modular architecture (standalone REST + Gateway) is conceptually good, but no built-in HTTP interaction endpoint server — you wire it up yourself.
- **Ecosystem:** ~929 stars, ~646 weekly npm downloads. Frequent breaking changes (v19 restructured Deno-first to Node-first, v21 latest). Docs are sparse/outdated. Small community.

---

### discord.js / @discordjs/core

- **Slash commands:** `SlashCommandBuilder` with a fluent API (`.addStringOption(...)`, etc.). Ergonomic, but no compile-time link between builder options and `interaction.options.getString('name')` — the option name is still a runtime string.
- **Type coverage:** Excellent. Uses `discord-api-types` internally (same org). Good interaction narrowing (`isChatInputCommand()` narrows to `ChatInputCommandInteraction`).
- **Dual backend:** The main `Client` class is **gateway-only** (issue #7231 open since 2022). However, **`@discordjs/core`** has a dedicated `http-only` export that excludes the WebSocket dependency entirely, plus a gateway mode. This is the closest to first-class dual-mode in any mainstream library, but it's lower-level — you wire up your own HTTP server and signature verification.
- **Ecosystem:** ~26,600 stars, ~1.5M weekly downloads. By far the largest community. Active maintenance. v14 stable, v15 in pre-release.

---

### Oceanic.js

- **Slash commands:** Has `ApplicationCommandBuilder` from `@oceanicjs/builders`. Similar pattern to discord.js. No compile-time type bridge between builder and handler.
- **Type coverage:** TypeScript-first from day one. Thorough types with good interaction narrowing. Covers all current API features including Components V2.
- **Dual backend:** Has `initRest()` for REST-only mode, but no built-in HTTP interaction endpoint server. Needs third-party package (`oceanic.js-interactions`) or DIY.
- **Ecosystem:** ~311 stars, ~224 weekly downloads. Clean API but very small community. Limited docs/examples.

---

### discordx

- **Slash commands:** **Best DX of all TypeScript options.** Uses decorators to define commands where the command definition IS the handler signature:
  ```typescript
  @Slash({ description: 'Say hello' })
  hello(
    @SlashOption({ name: 'name', type: ApplicationCommandOptionType.String, required: true })
    name: string,  // <-- typed parameter, auto-registered
    interaction: CommandInteraction,
  ) { ... }
  ```
  Closest to "define once, get types everywhere" in TypeScript.
- **Type coverage:** Inherits from discord.js (peer dependency).
- **Dual backend:** Inherits discord.js's limitation — no HTTP interactions support.
- **Ecosystem:** ~420 stars, ~1,841 weekly downloads. Requires experimental/stage 3 decorators.

---

### discord-api-types + discord-interactions (DIY approach)

- **Slash commands:** `discord-api-types` gives precise types for command registration payloads (`RESTPostAPIChatInputApplicationCommandsJSONBody`) and interaction bodies (`APIChatInputApplicationCommandInteraction`). No builder — you write your own thin typed wrapper.
- **Type coverage:** The gold standard. Updated within days of Discord API changes. Used by discord.js internally. Pure types, zero runtime.
- **Dual backend:** `discord-interactions` (Discord's official package) provides Ed25519 signature verification + Express middleware for HTTP mode. Pair with any gateway library or skip gateway entirely. Maximum flexibility.
- **Trade-off:** No framework — you build your own abstractions. Fits an architecture that already hand-rolls things like Firestore HTTP clients.

---

## TypeScript Summary Table

| | Slash cmd DX | Cmd def to handler type safety | API type coverage | HTTP interactions | Gateway | Community |
|---|---|---|---|---|---|---|
| **discordeno** | Raw objects | None | Good (own types) | DIY | Yes | Small |
| **discord.js** | SlashCommandBuilder | None | Excellent | No (main pkg) | Yes | Massive |
| **@discordjs/core** | Raw API types | None | Excellent | Yes (http-only export) | Yes | Moderate |
| **Oceanic.js** | Builder | None | Excellent | DIY | Yes | Tiny |
| **discordx** | Decorators | Partial (best TS option) | Excellent (via discord.js) | No | Yes | Small |
| **discord-api-types + discord-interactions** | DIY | You control it | Best | Yes (verification provided) | No (pair with another lib) | N/A |

**None of the TypeScript frameworks give compile-time type safety between command definitions and handlers out of the box.** discordx comes closest via decorators.

---

## Rust Frameworks

### Serenity + Poise

**Serenity** (~5,400 stars, ~143K monthly crate downloads) is the main Rust Discord library. **Poise** (~845 stars) is a command framework built on top of it — Serenity's own `StandardFramework` was deprecated in favor of Poise.

#### Slash command definition

Poise is the standout across both ecosystems. A proc macro on an async function means **the function signature IS the command definition** — compile-time type safety that no TypeScript library achieves:

```rust
#[derive(ChoiceParameter)]
enum GameMode { Easy, Medium, Hard }

/// Start a new game
#[poise::command(slash_command)]
async fn start_game(
    ctx: Context<'_>,
    #[description = "Difficulty level"] mode: GameMode,
    #[description = "Number of rounds"] #[min = 1] #[max = 10] rounds: u32,
) -> Result<(), Error> {
    ctx.say(format!("Starting {:?} with {} rounds", mode, rounds)).await?;
    Ok(())
}
```

- Doc comment becomes the command description
- `Option<T>` maps to optional parameter
- `GameMode` enum maps to string choices
- `u32` with `#[min]`/`#[max]` maps to integer option with bounds
- Rename an option? The compiler tells you everywhere it breaks.

Registration is a one-liner: `poise::builtins::register_globally(ctx, &framework.options().commands)`.

#### Discord API type coverage

Comprehensive. All interaction types, events, builders. Slightly lags behind Discord API changes (community-maintained, not Discord-official). Latest release Dec 2025.

#### Dual backend

Mixed. Gateway mode is first-class — that's what Poise's `Framework` builder is designed around. HTTP interactions are supported via Serenity's `interactions_endpoint` feature flag which provides a `Verifier` struct for Ed25519 signature verification, but you bring your own HTTP server (axum, actix-web) and manually wire interactions into your handlers. **Poise's framework is gateway-oriented** — using it in pure HTTP mode is not a first-class path.

#### Stability

Never reached 1.0. Serenity 0.12.0 was a massive breaking release (builders redesigned, naming conventions changed). Poise 0.5 to 0.6 also had significant breaks for Serenity 0.12 compat. Serenity 0.12.5 was declared the **final** 0.12.x release, with 0.13 planned but no timeline.

---

### Twilight

**~809 stars, modular crate ecosystem.** The "low-level" alternative to Serenity.

#### Slash command definition

Bare Twilight is verbose (manual API objects). The companion crate **twilight-interactions** adds derive macros on structs:

```rust
#[derive(CommandModel, CreateCommand)]
#[command(name = "hello", desc = "Say hello to someone")]
struct HelloCommand {
    /// Message to send
    message: String,
    /// User to send the message to
    user: Option<ResolvedUser>,
}

// Register
let cmd = HelloCommand::create_command();
client.create_global_command()
    .chat_input(cmd.name, cmd.description)?
    .command_options(&cmd.options)
    .await?;

// Handle
let hello = HelloCommand::from_interaction(data.into())?;
```

Compile-time safe (struct fields = options), but definition and handler are separated — less ergonomic than Poise's "function IS the command" approach.

#### Discord API type coverage

**The most comprehensive and up-to-date** of any Rust library. `twilight-model` is a pure data-definition crate that tracks Discord API changes closely. Already has Components V2 support (0.17.0).

#### Dual backend

**The best option for dual-mode bots.** Modular crates mean:
- Gateway: add `twilight-gateway`
- HTTP-only: just `twilight-model` + `twilight-http` — no gateway code compiled at all
- Production binary literally doesn't include WebSocket code

This maps perfectly to a gateway-for-dev / HTTP-for-prod architecture.

#### Stability

Also never 1.0. MSRV is Rust 1.89 (quite recent). Breaking changes between minor versions, but the modular design limits blast radius.

---

## Full Comparison Table

| | discordeno | discord.js | @discordjs/core | Poise (Serenity) | Twilight |
|---|---|---|---|---|---|
| **Slash cmd DX** | Raw objects | SlashCommandBuilder | Raw API types | Proc macro on fn (best) | Derive macro on struct |
| **Cmd to handler type safety** | None | None | None | **Full (compile-time)** | **Full (compile-time)** |
| **API type coverage** | Good | Excellent | Excellent | Good | Best |
| **Gateway** | Yes | Yes | Yes | Yes (first-class) | Yes (separate crate) |
| **HTTP interactions** | DIY | No | Yes (http-only export) | Supported (feature flag, DIY server) | **Natural fit** (just use http+model) |
| **Dual-mode ease** | DIY | N/A | Good | Possible but gateway-oriented | **Excellent** |
| **Community size** | Small | Massive | Moderate | Large (Rust ecosystem) | Moderate |
| **Stability** | Frequent breaks | Moderate | Moderate | Moderate (no 1.0) | Moderate (no 1.0) |
| **Language** | TypeScript | TypeScript | TypeScript | Rust | Rust |

---

## Key Takeaways

If compile-time type safety between command definitions and handlers is the priority, **Rust delivers on that promise better than any TypeScript library can**. Poise's macro system is the best slash command DX across both ecosystems.

The trade-off is the usual Rust trade-off: slower iteration speed, more boilerplate for things like JSON/HTTP, and a rewrite of the existing Firestore client (or finding a Rust one).

For dual-mode specifically, Twilight's modular architecture is the cleanest fit for a gateway-dev / HTTP-prod pattern, but Poise has the better command ergonomics.

### Best TypeScript options for dual-mode

1. **`@discordjs/core`** — only mainstream library with first-class support for both modes from a single codebase, but lower-level than the main discord.js package.
2. **`discord-api-types` + `discord-interactions` + thin custom wrapper** — matches an existing hand-rolled architecture style, maximum type coverage with minimal dependency churn.
3. **discord.js** — biggest community and best docs, but HTTP mode is DIY.

### Best Rust options for dual-mode

1. **Twilight** — modular architecture is ideal, production binary excludes gateway code entirely.
2. **Serenity + Poise** — best command DX in any language, but gateway-oriented. HTTP mode is second-class.
