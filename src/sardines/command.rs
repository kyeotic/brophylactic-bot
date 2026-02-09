use std::collections::HashSet;

use poise::serenity_prelude as serenity;
use serenity::{
    CreateActionRow, CreateButton, CreateInteractionResponse, CreateInteractionResponseMessage,
    EditMessage,
};
use tracing::{error, info};

use crate::context::{Context, get_game_lock, remove_game_lock};
use crate::discord::helpers::{encode_custom_id, parse_custom_id, rep_label};
use crate::discord::types::{GuildMember, InteractionType};
use crate::jobs::JobType;
use crate::sardines::game::join_failure_chance;
use crate::sardines::game::{Sardines, SardinesJobPayload};
use crate::sardines::store::SardinesStore;
use crate::util::dates::is_today;

/// Start a game of sardines
#[poise::command(slash_command, guild_only)]
pub async fn sardines(
    ctx: Context<'_>,
    #[description = "Amount of rep for the buy-in. Cannot exceed your total rep"] bet: i64,
) -> Result<(), anyhow::Error> {
    let guild_id = ctx
        .guild_id()
        .ok_or_else(|| anyhow::anyhow!("Must be in a guild"))?;
    let author = ctx.author();
    let member = ctx
        .author_member()
        .await
        .ok_or_else(|| anyhow::anyhow!("Could not get member info"))?;
    let guild_member =
        GuildMember::from_serenity(guild_id, author, member.joined_at, member.nick.as_deref());

    let data = ctx.data();

    // Check daily limit
    let last_sardines = data
        .user_store
        .get_user_last_sardines(&guild_member)
        .await?;
    if let Some(last) = last_sardines
        && is_today(data.config.discord.timezone, last)
    {
        ctx.send(
            poise::CreateReply::default()
                .content("You already started a sardines game today")
                .ephemeral(true),
        )
        .await?;
        return Ok(());
    }

    let mut sardines = match Sardines::init(
        data.db.clone(),
        &data.config,
        data.user_store.clone(),
        &guild_member,
        bet,
    ) {
        Ok(s) => s,
        Err(e) => {
            ctx.send(
                poise::CreateReply::default()
                    .content(e.to_string())
                    .ephemeral(true),
            )
            .await?;
            return Ok(());
        }
    };

    // Check rep
    let member_rep = data.user_store.get_user_rep(&guild_member).await?;
    if member_rep < sardines.buy_in() {
        let username = &guild_member.username;
        let buy_in_label = rep_label(sardines.buy_in(), false);
        ctx.send(
            poise::CreateReply::default()
                .content(format!(
                    "{username} only has {member_rep} and cannot bet in a sardines game whose buy-in is {buy_in_label}"
                ))
                .ephemeral(true),
        )
        .await?;
        return Ok(());
    }

    // Save the game (saves to Firestore, deducts creator bet)
    sardines.save().await?;

    // Record last sardines date
    data.user_store
        .set_user_last_sardines(&guild_member, chrono::Utc::now())
        .await?;

    // Send initial message with join button
    let (content, button) = sardines_message_parts(&sardines);
    let row = CreateActionRow::Buttons(vec![button]);
    let reply = ctx
        .send(
            poise::CreateReply::default()
                .content(content)
                .components(vec![row]),
        )
        .await?;

    // Capture message coordinates for the timeout job
    let message = reply.message().await?;
    let channel_id = message.channel_id.get();
    let message_id = message.id.get();

    // Enqueue the timeout job
    let job_queue = data.job_queue.read().await;
    sardines
        .enqueue_timeout(
            channel_id,
            message_id,
            &job_queue,
            data.config.sardines_expiry_seconds,
        )
        .await?;

    Ok(())
}

/// Handle the SARDINES button interaction (player joining).
pub async fn handle_sardines_join(
    ctx: &serenity::Context,
    interaction: &serenity::ComponentInteraction,
    data: &crate::context::AppContext,
) -> Result<(), anyhow::Error> {
    let custom_id = &interaction.data.custom_id;
    let (_, game_id) = parse_custom_id(custom_id);

    let guild_id = interaction
        .guild_id
        .ok_or_else(|| anyhow::anyhow!("Must be in a guild"))?;

    let member_info = interaction
        .member
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("No member data"))?;
    let guild_member = GuildMember::from_serenity(
        guild_id,
        &interaction.user,
        member_info.joined_at,
        member_info.nick.as_deref(),
    );

    // Acquire per-game write lock to serialize join operations
    let game_lock = get_game_lock(&data.game_locks, game_id);
    let _guard = game_lock.write().await;

    let mut game = match Sardines::load(
        data.db.clone(),
        &data.config,
        data.user_store.clone(),
        game_id,
    )
    .await
    {
        Ok(s) => s,
        Err(_) => {
            interaction
                .create_response(ctx, CreateInteractionResponse::Acknowledge)
                .await?;
            return Ok(());
        }
    };

    if let Some(error_msg) = validate_join(&game, &guild_member, data).await? {
        respond_ephemeral(ctx, interaction, error_msg).await?;
        return Ok(());
    }

    // Check if this join will end the game BEFORE adding the player
    let game_continues = game.can_add_player();

    // Always add the player (charges their bet)
    game.add_player(&guild_member).await?;

    let response = if game_continues {
        let (content, button) = sardines_message_parts(&game);
        let row = CreateActionRow::Buttons(vec![button]);
        CreateInteractionResponseMessage::new()
            .content(content)
            .components(vec![row])
    } else {
        // Game ends — joiner is already in the player pool
        let final_message = game.finish(Some(&guild_member.username)).await?;
        CreateInteractionResponseMessage::new()
            .content(final_message)
            .components(vec![])
    };

    interaction
        .create_response(ctx, CreateInteractionResponse::UpdateMessage(response))
        .await?;

    Ok(())
}

/// Validate whether a player can join a sardines game. Returns an error message if invalid.
async fn validate_join(
    game: &Sardines,
    guild_member: &GuildMember,
    data: &crate::context::AppContext,
) -> Result<Option<String>, anyhow::Error> {
    if game.players().iter().any(|p| p.id == guild_member.id) && !game.can_join_repeat(&data.config)
    {
        let min_players = data.config.min_players_before_rejoin;
        return Ok(Some(format!(
            "Cannot join a sardines game you are already in until the minimum player count of {min_players} is met."
        )));
    }

    let member_rep = data.user_store.get_user_rep(guild_member).await?;
    if member_rep < game.buy_in() {
        return Ok(Some("You do not have enough rep".to_string()));
    }

    Ok(None)
}

/// Send an ephemeral error response to an interaction.
async fn respond_ephemeral(
    ctx: &serenity::Context,
    interaction: &serenity::ComponentInteraction,
    content: impl Into<String>,
) -> Result<(), anyhow::Error> {
    interaction
        .create_response(
            ctx,
            CreateInteractionResponse::Message(
                CreateInteractionResponseMessage::new()
                    .content(content)
                    .ephemeral(true),
            ),
        )
        .await?;
    Ok(())
}

/// Job handler for sardines:finish (timeout)
pub async fn finish_sardines(
    ctx: crate::context::AppContext,
    payload: SardinesJobPayload,
) -> anyhow::Result<()> {
    // Acquire per-game write lock to prevent joins during finish
    let game_lock = get_game_lock(&ctx.game_locks, &payload.id);
    let guard = game_lock.write().await;

    let result = do_finish_sardines(&ctx, &payload).await;

    drop(guard);
    remove_game_lock(&ctx.game_locks, &payload.id);

    result
}

async fn do_finish_sardines(
    ctx: &crate::context::AppContext,
    payload: &SardinesJobPayload,
) -> anyhow::Result<()> {
    let game = match Sardines::load(
        ctx.db.clone(),
        &ctx.config,
        ctx.user_store.clone(),
        &payload.id,
    )
    .await
    {
        Ok(g) => g,
        Err(_) => {
            // Game was already finished by a player joining — expected case
            info!(
                id = payload.id,
                "Sardines game not found for timeout (likely already ended)"
            );
            return Ok(());
        }
    };

    info!(
        id = payload.id,
        players = game.players().len(),
        "Finishing sardines game via timeout"
    );

    let final_message = game.finish(None).await?;

    // Edit the original Discord message
    let channel_id = serenity::ChannelId::new(payload.channel_id);
    let message_id = serenity::MessageId::new(payload.message_id);

    let edit = EditMessage::new().content(final_message).components(vec![]);

    if let Err(e) = channel_id.edit_message(&*ctx.http, message_id, edit).await {
        error!(error = %e, "Failed to update sardines timeout message");
    }

    Ok(())
}

/// Recover orphaned sardines games on startup.
/// Games with pending jobs are handled by the job queue's startup poll.
/// Games without jobs (orphaned) are finished immediately.
pub async fn recover_sardines(ctx: &crate::context::AppContext) {
    let store = SardinesStore::new(ctx.db.clone());
    let all_games = match store.list_all().await {
        Ok(games) => games,
        Err(e) => {
            error!(error = %e, "Failed to list sardines games for recovery");
            return;
        }
    };

    if all_games.is_empty() {
        return;
    }

    info!(
        count = all_games.len(),
        "Checking sardines games for recovery"
    );

    // Collect IDs of games that have pending sardines:finish jobs
    let pending_jobs = {
        let queue = ctx.job_queue.read().await;
        match queue.get_pending_jobs().await {
            Ok(jobs) => jobs,
            Err(e) => {
                error!(error = %e, "Failed to get pending jobs for sardines recovery");
                return;
            }
        }
    };

    let sardines_job_game_ids: HashSet<String> = pending_jobs
        .iter()
        .filter(|j| j.job_type == JobType::SardinesFinish)
        .filter_map(|j| {
            serde_json::from_value::<SardinesJobPayload>(j.payload.clone())
                .ok()
                .map(|p| p.id)
        })
        .collect();

    // Finish orphaned games (no pending job)
    for game in all_games {
        if sardines_job_game_ids.contains(&game.id) {
            continue; // Job exists, it will handle this game
        }

        info!(
            id = game.id,
            "Finishing orphaned sardines game (no pending job)"
        );
        let sardines =
            Sardines::from_lottery(ctx.db.clone(), &ctx.config, ctx.user_store.clone(), game);
        if let Err(e) = sardines.finish(None).await {
            error!(error = %e, "Failed to finish orphaned sardines game");
        }
    }
}

fn sardines_message_parts(game: &Sardines) -> (String, CreateButton) {
    let content = build_sardines_content(&game.creator().username, game.bet(), game.players());
    let button = CreateButton::new(encode_custom_id(InteractionType::Sardines, game.id()))
        .label("Join Sardines");
    (content, button)
}

fn build_sardines_content(
    creator_name: &str,
    bet: i64,
    players: &[crate::games::lottery::DbPlayer],
) -> String {
    let failure_chance = join_failure_chance(players.len()) * 100.0;
    let bet_label = rep_label(bet, false);

    let banner = format!(
        "{creator_name} has started a sardines game for {bet_label}. Click the button below to pay the buy-in and attempt to join the game.\nThere is currently a {failure_chance:.2}% chance of ending the game when joining. A winner is randomly selected among all players in the game."
    );

    if players.len() < 2 {
        banner
    } else {
        let player_names: Vec<&str> = players.iter().map(|p| p.username.as_str()).collect();
        let player_list = player_names.join("\n");
        format!("{banner}\n\n**Players**\n{player_list}")
    }
}
