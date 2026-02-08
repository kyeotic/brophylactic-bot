# Rust migration code review

This project recently moved from Typescript to Rust. Migration was done as close to 1:1 as possible. This has carried over some ts/js idioms that are not a good fit for rust, as well as some general code quality issues there were pre-existing. This review should be seen as a starting point; user collected thoughts that are not exhaustive of all issues.

This should be a conversation! Do not make any change on your own. Provide feedback on this review, and provide any additional concerns or points that you feel apply.

## General notes

- I prefer the `format!("name {name} of {age} years")` format to the `format!("name {} of {} years", name, age)` format. Prefer the former unless there is a lot (more than 3) of pre-allocation needed to access function results or fields, e.g. `format!("name {} of {} years", person.name, formatInYears(person.age))`. There is a balance though, very long strings may warrant pre-allocation of many values to help readability.

## main.rs

- main() is quite a large function with significant indention, can it be broken down?
- using `db.clone()` for the stores and queues feels unnecessary. Can they be made to work with references? Would that overcomplicate lifetimes? Does this cloning result in possible race conditions or un-synced store state?
- job_queue.register takes a string for the job type. This should probably be an enum; this might enable the payload to be strongly typed to the job
- more cloning: http is cloned only to be passed by reference to `finish_roulette`. is this necessary?
- job_queue interval: this should be part of Config
- recover_countdowns: this seems like it should be part of a seperate jobqueue init, or part of the roulette init. Doesnt belong in main
- intents: this sould be part of Config
- parse_custom_id -> match: this feels weird. Shouldnt the string parsing produce an enum for known commands, and match on that? Is this a good place to impl TryFrom for a command Enum?

## config.rs

- stage does not appear to be set anywhere, and is only used in sardines

## util/dates.rs

- is there a more idiotmatic way to implement `get_day_string`?

## users/store.rs

- increment_user_reps has a loop where a user is cloned to change one field. Is there a more compact way to write this?
- increment_user_reps does a read inside a transaction, but the read is not connected to the transactional write. Is there a protection I am not seeing against concurrent updates?
- there is a lot of repetition of  the firestore fluent API. Can this be collected into any helpers?
- is get_id() the most idiomatic way to do concatenation with a delimiter?

## sardines/command.rs

- is `#[description]` supposed to provide tooltip info? Its not working in VS Code
- is `to_guild_member` the idiomatic way to do type casting? I thought rust prefered from/into.
- are top-level methods that are conceptually grouped like `handle_sardines_join`, `sardines_message_parts`, and `build_sardines_content` normal? Should these be grouped by an `impl` or something?
- `handle_sardines_join` is quite long

## sardines/sardines.rs

- `min_players_before_rejoin` this should be declared in config, not configured in this function
- `join_failure_chance` the comment explaining this algorithm is not clear. What does this math mean?
- `impl Sardines` seems like a good place for the methods in `sardines/command.rs`. Would moving them here introduce a circular referece?
- `Sardines.init` takes in a `&FirestoreDb` just to `clone()` it internally. That seems odd, and at odds with how the `UserStore` does things. My understanding is that the API should indicate ownership, not hide it internally.
- `Sardines.load` takes in another `&FirestoreDb`, even though one was `clone()`-ed in `init`. Seems like Sardines should hold its own db clone
- ``Sardines.load` takes in a `&UserStore`. This seems like it should go in `init()` too
- `pot_size` seems incorrect: its the players + 1. Is the loser not already in the players array? This is perhaps a TS conversion issue.
- `get_multiplier` this function seems to have a more general form: select a seeded-random element from an array. We should make that
- `get_payout` uses floor() on the multiplier, but the multipliers all have a floating/decimal component. This will change their value, right?
- why does `finish` dedupe names? Can players join multiple times?
- `finish` result message is the perfect example of a string so long that is should use the inline format, even if all the names need a dedicated variable beforehand

## roulette/commands.rs

- `roulette` (the command) is long and mixes logic and display. I think we should break this up a little. It may be worth pulling the UI/display generating elements into their own module; if not, at least their own functions in this file.
- `handle_roulette_join` is also very long. 

## games/dice.rs

- uses regex for parsing. Is there not a rust library for parsing dice strings?
  
## games/lottery.rs

- `StoredPlayer` is not the best name. I believe this was `SerialPlayer` in TS, which felt more descriptive to me. Im open to ideas. Maybe `DbPlayer`?
- `from_parts` is dead? how do lotteries get restored?

## discord/helper.rs

- dead code in here seems related to HTTP gateway that is still pending
  

## commands/

- This whole module seems wrong. I think having a `commands.rs` module in `src/` that has very thin mapping to handler methods in their respective folders would be better. The commands that dont have their own folder (e.g. bgr, debug) should maybe get a new home?? `guess` and `roll` should go in `games/`