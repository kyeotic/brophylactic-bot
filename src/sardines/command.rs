use poise::serenity_prelude as serenity;
use serenity::{
    CreateActionRow, CreateButton, CreateInteractionResponse, CreateInteractionResponseMessage,
};

use crate::context::Context;
use crate::discord::helpers::{bgr_label, encode_custom_id, parse_custom_id, to_guild_member};
use crate::discord::types::InteractionType;
use crate::sardines::sardines::{join_failure_chance, Sardines};
use crate::util::dates::is_today;

/// Start a game of sardines
#[poise::command(slash_command, guild_only)]
pub async fn sardines(
    ctx: Context<'_>,
    #[description = "Amount of rep for the buy-in. Cannot exceed your total rep"] bet: i64,
) -> Result<(), anyhow::Error> {
    let guild_id = ctx.guild_id().ok_or_else(|| anyhow::anyhow!("Must be in a guild"))?;
    let author = ctx.author();
    let member = ctx
        .author_member()
        .await
        .ok_or_else(|| anyhow::anyhow!("Could not get member info"))?;
    let guild_member = to_guild_member(guild_id, author, member.joined_at);

    let data = ctx.data();

    // Check daily limit
    let last_sardines = data.user_store.get_user_last_sardines(&guild_member).await?;
    if let Some(last) = last_sardines {
        if is_today(&data.config.discord.timezone, last) {
            ctx.send(
                poise::CreateReply::default()
                    .content("You already started a sardines game today")
                    .ephemeral(true),
            )
            .await?;
            return Ok(());
        }
    }

    let mut sardines = match Sardines::init(&data.db, &data.config, &guild_member, bet) {
        Ok(s) => s,
        Err(e) => {
            ctx.send(poise::CreateReply::default().content(e.to_string()).ephemeral(true))
                .await?;
            return Ok(());
        }
    };

    // Check rep
    let member_rep = data.user_store.get_user_rep(&guild_member).await?;
    if member_rep < sardines.buy_in() {
        ctx.send(
            poise::CreateReply::default()
                .content(format!(
                    "{} only has {} and cannot bet in a sardines game whose buy-in is {}",
                    guild_member.username,
                    member_rep,
                    bgr_label(sardines.buy_in(), false),
                ))
                .ephemeral(true),
        )
        .await?;
        return Ok(());
    }

    // Start the game (saves to Firestore, deducts creator bet)
    sardines.start(&data.user_store).await?;

    // Record last sardines date
    data.user_store
        .set_user_last_sardines(&guild_member, chrono::Utc::now())
        .await?;

    // Send initial message with join button
    let (content, button) = sardines_message_parts(&sardines);
    let row = CreateActionRow::Buttons(vec![button]);
    ctx.send(
        poise::CreateReply::default()
            .content(content)
            .components(vec![row]),
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
    let guild_member = to_guild_member(guild_id, &interaction.user, member_info.joined_at);

    let mut game = match Sardines::load(&data.db, &data.config, game_id).await {
        Ok(s) => s,
        Err(_) => {
            interaction
                .create_response(ctx, CreateInteractionResponse::Acknowledge)
                .await?;
            return Ok(());
        }
    };

    // Check rejoin rules
    if game.players().iter().any(|p| p.id == guild_member.id) {
        if !game.can_join_repeat(&data.config) {
            interaction
                .create_response(
                    ctx,
                    CreateInteractionResponse::Message(
                        CreateInteractionResponseMessage::new()
                            .content(format!(
                                "Cannot join a sardines game you are already in until the minimum player count of {} is met.",
                                crate::sardines::sardines::min_players_before_rejoin(&data.config)
                            ))
                            .ephemeral(true),
                    ),
                )
                .await?;
            return Ok(());
        }
    }

    // Check rep
    let member_rep = data.user_store.get_user_rep(&guild_member).await?;
    if member_rep < game.buy_in() {
        interaction
            .create_response(
                ctx,
                CreateInteractionResponse::Message(
                    CreateInteractionResponseMessage::new()
                        .content("You do not have enough rep")
                        .ephemeral(true),
                ),
            )
            .await?;
        return Ok(());
    }

    if game.can_add_player() {
        // Game continues — add the player
        game.add_player(&guild_member, &data.user_store).await?;

        let (content, button) = sardines_message_parts(&game);
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
    } else {
        // Game ends — this player is the loser
        let final_message = game.finish(&guild_member, &data.user_store).await?;
        interaction
            .create_response(
                ctx,
                CreateInteractionResponse::UpdateMessage(
                    CreateInteractionResponseMessage::new()
                        .content(final_message)
                        .components(vec![]),
                ),
            )
            .await?;
    }

    Ok(())
}

fn sardines_message_parts(game: &Sardines) -> (String, CreateButton) {
    let content = build_sardines_content(
        &game.creator().username,
        game.bet(),
        game.players(),
    );
    let button = CreateButton::new(encode_custom_id(InteractionType::Sardines, game.id())).label("Join Sardines");
    (content, button)
}

fn build_sardines_content(
    creator_name: &str,
    bet: i64,
    players: &[crate::games::lottery::StoredPlayer],
) -> String {
    let failure_chance = join_failure_chance(players.len()) * 100.0;

    let banner = format!(
        "{} has started a sardines game for {}. Click the button below to pay the buy-in and attempt to join the game.\nThere is currently a {:.2}% chance of ending the game when joining. A winner is randomly selected among all players in the game _before_ it ends.",
        creator_name,
        bgr_label(bet, false),
        failure_chance,
    );

    if players.len() < 2 {
        banner
    } else {
        let player_names: Vec<&str> = players.iter().map(|p| p.username.as_str()).collect();
        format!("{}\n\n**Players**\n{}", banner, player_names.join("\n"))
    }
}
