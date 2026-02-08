use chrono::DateTime;
use serenity::all::{
    CreateActionRow, CreateButton, CreateInteractionResponse, CreateInteractionResponseMessage,
    GuildId, Timestamp, User,
};

use crate::discord::types::{GuildMember, InteractionType};

/// Build a simple text response message.
#[allow(dead_code)]
pub fn message(content: &str, ephemeral: bool) -> CreateInteractionResponse {
    CreateInteractionResponse::Message(
        CreateInteractionResponseMessage::new()
            .content(content)
            .ephemeral(ephemeral),
    )
}

/// Build a response with a button component.
#[allow(dead_code)]
pub fn message_with_button(
    content: &str,
    button_id: &str,
    button_label: &str,
) -> CreateInteractionResponse {
    let button = CreateButton::new(button_id).label(button_label);
    let row = CreateActionRow::Buttons(vec![button]);

    CreateInteractionResponse::Message(
        CreateInteractionResponseMessage::new()
            .content(content)
            .components(vec![row]),
    )
}

/// Format a BGR (reputation) label.
pub fn bgr_label(amount: impl std::fmt::Display, bold: bool) -> String {
    if bold {
        format!("**\u{211e}{}**", amount)
    } else {
        format!("\u{211e}{}", amount)
    }
}

/// Format a user mention.
pub fn mention(user_id: impl std::fmt::Display) -> String {
    format!("<@{}>", user_id)
}

/// Encode a type and id into a custom_id for message components.
pub fn encode_custom_id(id_type: InteractionType, id: &str) -> String {
    format!("{id_type}:{id}")
}

/// Parse an encoded custom_id into (type, id).
pub fn parse_custom_id(custom_id: &str) -> (&str, &str) {
    custom_id.split_once(':').unwrap_or((custom_id, ""))
}

/// Convert serenity types into our GuildMember type.
pub fn to_guild_member(
    guild_id: GuildId,
    user: &User,
    joined_at: Option<Timestamp>,
) -> GuildMember {
    GuildMember {
        id: user.id.to_string(),
        guild_id: guild_id.to_string(),
        username: user.name.clone(),
        joined_at: joined_at
            .and_then(|ts| DateTime::from_timestamp(ts.unix_timestamp(), 0)),
    }
}
