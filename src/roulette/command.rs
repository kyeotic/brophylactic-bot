use std::sync::Arc;

use chrono::DateTime;
use firestore::FirestoreDb;
use poise::serenity_prelude as serenity;
use serenity::{
    CreateActionRow, CreateButton, CreateInteractionResponse, CreateInteractionResponseMessage,
    EditInteractionResponse,
};
use tokio::sync::RwLock;
use tracing::{error, info};

use crate::context::Context;
use crate::discord::helpers::{bgr_label, encode_custom_id, parse_custom_id};
use crate::discord::types::{GuildMember, InteractionType};
use crate::jobs::{JobQueue, JobType};
use crate::roulette::game::{ROULETTE_TIME_MS, Roulette, RouletteJobPayload};
use crate::users::UserStore;
const COUNTDOWN_INTERVAL_MS: u64 = 5000;

/// Start a game of roulette
#[poise::command(slash_command, guild_only)]
pub async fn roulette(
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
    let guild_member = GuildMember::from_serenity(guild_id, author, member.joined_at);

    let data = ctx.data();
    let member_rep = data.user_store.get_user_rep(&guild_member).await?;

    let mut roulette = match Roulette::init(data.db.clone(), &guild_member, bet) {
        Ok(r) => r,
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

    if member_rep < roulette.buy_in() {
        let username = &guild_member.username;
        let buy_in_label = bgr_label(roulette.buy_in(), false);
        ctx.send(
            poise::CreateReply::default()
                .content(format!(
                    "{username} only has {member_rep} and cannot bet in a roulette game whose buy-in is {buy_in_label}"
                ))
                .ephemeral(true),
        )
        .await?;
        return Ok(());
    }

    // Deduct creator's bet
    data.user_store
        .increment_user_rep(&guild_member, -roulette.bet())
        .await?;

    // Get the interaction token for message updates
    let interaction_token = match &ctx {
        poise::Context::Application(app_ctx) => app_ctx.interaction.token.clone(),
        _ => return Err(anyhow::anyhow!("Expected application command")),
    };

    let job_queue = data.job_queue.read().await;
    roulette.start(&interaction_token, &job_queue).await?;

    // Send the initial message
    let (content, button) = roulette_message_parts(&roulette);
    let row = CreateActionRow::Buttons(vec![button]);
    ctx.send(
        poise::CreateReply::default()
            .content(content)
            .components(vec![row]),
    )
    .await?;

    // Start countdown
    start_countdown(
        roulette.id().to_string(),
        roulette.start_time().cloned().unwrap_or_default(),
        interaction_token,
        data.http.clone(),
        data.db.clone(),
    );

    Ok(())
}

/// Handle the ROULETTE button interaction (player joining).
pub async fn handle_roulette_join(
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
    let guild_member =
        GuildMember::from_serenity(guild_id, &interaction.user, member_info.joined_at);

    let mut game = match Roulette::load(data.db.clone(), game_id).await {
        Ok(r) => r,
        Err(_) => {
            interaction
                .create_response(ctx, CreateInteractionResponse::Acknowledge)
                .await?;
            return Ok(());
        }
    };

    if let Some(error_msg) = validate_roulette_join(&game, &guild_member, data).await? {
        respond_ephemeral(ctx, interaction, error_msg).await?;
        return Ok(());
    }

    // Deduct bet
    data.user_store
        .increment_user_rep(&guild_member, -game.bet())
        .await?;

    game.add_player(&guild_member).await?;

    // Update the message with new player list
    let (content, button) = roulette_message_parts(&game);
    let row = CreateActionRow::Buttons(vec![button]);
    interaction
        .create_response(
            ctx,
            CreateInteractionResponse::UpdateMessage(
                CreateInteractionResponseMessage::new()
                    .content(content)
                    .components(vec![row]),
            ),
        )
        .await?;

    Ok(())
}

/// Validate whether a player can join a roulette game. Returns an error message if invalid.
async fn validate_roulette_join(
    game: &Roulette,
    guild_member: &GuildMember,
    data: &crate::context::AppContext,
) -> Result<Option<String>, anyhow::Error> {
    if game.players().iter().any(|p| p.id == guild_member.id) {
        return Ok(Some(
            "Cannot join a roulette game you are already in".to_string(),
        ));
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

/// Job handler for roulette:finish
pub async fn finish_roulette(
    payload: serde_json::Value,
    http: &serenity::Http,
    db: &FirestoreDb,
    user_store: &UserStore,
) -> anyhow::Result<()> {
    let payload: RouletteJobPayload = serde_json::from_value(payload)?;

    let game = Roulette::load(db.clone(), &payload.id).await?;
    let final_message = game.finish(user_store).await?;

    // Update Discord message with final result (no button)
    let edit = EditInteractionResponse::new()
        .content(final_message)
        .components(vec![]);

    if let Err(e) = http
        .edit_original_interaction_response(&payload.interaction_token, &edit, vec![])
        .await
    {
        error!(error = %e, "Failed to update roulette finish message");
    }

    Ok(())
}

/// Recover pending roulette countdowns on startup.
pub async fn recover_countdowns(
    db: &FirestoreDb,
    http: &Arc<serenity::Http>,
    job_queue: &Arc<RwLock<JobQueue>>,
) {
    let jobs = {
        let queue = job_queue.read().await;
        match queue.get_pending_jobs().await {
            Ok(jobs) => jobs,
            Err(e) => {
                error!(error = %e, "Failed to get pending jobs for roulette recovery");
                return;
            }
        }
    };

    let roulette_jobs: Vec<_> = jobs
        .into_iter()
        .filter(|j| j.job_type == JobType::RouletteFinish)
        .collect();

    for job in roulette_jobs {
        let payload: RouletteJobPayload = match serde_json::from_value(job.payload) {
            Ok(p) => p,
            Err(e) => {
                error!(error = %e, "Failed to parse roulette job payload");
                continue;
            }
        };

        match Roulette::load(db.clone(), &payload.id).await {
            Ok(game) => {
                if let Some(start_time) = game.start_time() {
                    info!(id = payload.id, "Recovering countdown for roulette");
                    start_countdown(
                        game.id().to_string(),
                        start_time.clone(),
                        payload.interaction_token,
                        http.clone(),
                        db.clone(),
                    );
                }
            }
            Err(e) => {
                error!(error = %e, id = payload.id, "Failed to load roulette for recovery");
            }
        }
    }
}

fn start_countdown(
    game_id: String,
    start_time_str: String,
    interaction_token: String,
    http: Arc<serenity::Http>,
    db: FirestoreDb,
) {
    let end_time_ms = {
        let start = DateTime::parse_from_rfc3339(&start_time_str)
            .map(|dt| dt.timestamp_millis())
            .unwrap_or_else(|_| chrono::Utc::now().timestamp_millis());
        start + ROULETTE_TIME_MS as i64
    };

    tokio::spawn(async move {
        // Load game state once for countdown display. The join handler
        // updates the message with fresh player data on each join, so
        // a slightly stale player list between ticks is acceptable.
        let game = match Roulette::load(db, &game_id).await {
            Ok(g) => g,
            Err(_) => return,
        };
        let creator_name = game.creator().username.clone();
        let bet = game.bet();
        let players = game.players().to_vec();

        tokio::time::sleep(tokio::time::Duration::from_millis(COUNTDOWN_INTERVAL_MS)).await;

        loop {
            let now_ms = chrono::Utc::now().timestamp_millis();
            let remaining_secs = (end_time_ms - now_ms) / 1000;
            if remaining_secs <= 0 {
                break;
            }

            let content = build_roulette_content(&creator_name, bet, remaining_secs, &players);
            let button = CreateButton::new(encode_custom_id(InteractionType::Roulette, &game_id))
                .label("Join Roulette");
            let row = CreateActionRow::Buttons(vec![button]);

            let edit = EditInteractionResponse::new()
                .content(content)
                .components(vec![row]);

            if let Err(e) = http
                .edit_original_interaction_response(&interaction_token, &edit, vec![])
                .await
            {
                error!(error = %e, "Countdown update failed");
            }

            tokio::time::sleep(tokio::time::Duration::from_millis(COUNTDOWN_INTERVAL_MS)).await;
        }
    });
}

fn roulette_message_parts(game: &Roulette) -> (String, CreateButton) {
    let start_time_str = game.start_time().expect("roulette must have start time");
    let start_ms = DateTime::parse_from_rfc3339(start_time_str)
        .map(|dt| dt.timestamp_millis())
        .unwrap_or_else(|_| chrono::Utc::now().timestamp_millis());
    let end_ms = start_ms + ROULETTE_TIME_MS as i64;
    let now_ms = chrono::Utc::now().timestamp_millis();
    let remaining = (end_ms - now_ms) / 1000;

    let content = build_roulette_content(
        &game.creator().username,
        game.bet(),
        remaining,
        game.players(),
    );
    let button = CreateButton::new(encode_custom_id(InteractionType::Roulette, game.id()))
        .label("Join Roulette");
    (content, button)
}

fn build_roulette_content(
    creator_name: &str,
    bet: i64,
    remaining_secs: i64,
    players: &[crate::games::lottery::PersistedPlayer],
) -> String {
    let bet_label = bgr_label(bet, false);
    let banner = format!(
        "{creator_name} has started a roulette game for {bet_label}. Click the button below within {remaining_secs} seconds to place an equal bet and join the game."
    );

    if players.len() < 2 {
        banner
    } else {
        let player_names: Vec<&str> = players.iter().map(|p| p.username.as_str()).collect();
        let player_list = player_names.join("\n");
        format!("{banner}\n\n**Players**\n{player_list}")
    }
}
