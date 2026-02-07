use crate::context::Context;
use crate::discord::helpers::{bgr_label, encode_custom_id, mention};
use crate::util::random::random_inclusive;

use poise::serenity_prelude as serenity;
use serenity::{
    CreateActionRow, CreateButton, CreateInteractionResponse, CreateInteractionResponseMessage,
};

const ID_TYPE: &str = "DEBUG";

/// Run debug commands
#[poise::command(slash_command, guild_only)]
pub async fn debug(ctx: Context<'_>) -> Result<(), anyhow::Error> {
    let id = nanoid::nanoid!();
    let content = format!("This is a content debug: {}", bgr_label(200, true));
    let button = CreateButton::new(encode_custom_id(ID_TYPE, &id)).label("Debug");
    let row = CreateActionRow::Buttons(vec![button]);

    ctx.send(
        poise::CreateReply::default()
            .content(content)
            .components(vec![row]),
    )
    .await?;

    Ok(())
}

/// Handle the DEBUG button interaction.
pub async fn handle_debug_button(
    ctx: &serenity::Context,
    interaction: &serenity::ComponentInteraction,
) -> Result<(), anyhow::Error> {
    let custom_id = &interaction.data.custom_id;
    let user_id = interaction.user.id;
    let value = random_inclusive(50, 100);

    let content = format!(
        "This is a content debug: {}. Hey {}",
        bgr_label(value, true),
        mention(user_id)
    );

    let button = CreateButton::new(encode_custom_id(ID_TYPE, custom_id)).label("Debug");
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
