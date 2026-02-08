use crate::discord::types::InteractionType;

/// Format a BGR (reputation) label.
pub fn bgr_label(amount: impl std::fmt::Display, bold: bool) -> String {
    if bold {
        format!("**\u{211e}{amount}**")
    } else {
        format!("\u{211e}{amount}")
    }
}

/// Format a user mention.
pub fn mention(user_id: impl std::fmt::Display) -> String {
    format!("<@{user_id}>")
}

/// Encode a type and id into a custom_id for message components.
pub fn encode_custom_id(id_type: InteractionType, id: &str) -> String {
    format!("{id_type}:{id}")
}

/// Parse an encoded custom_id into (type, id).
pub fn parse_custom_id(custom_id: &str) -> (&str, &str) {
    custom_id.split_once(':').unwrap_or((custom_id, ""))
}
