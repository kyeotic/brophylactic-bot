use chrono::{DateTime, Utc};

/// Simplified guild member info extracted from Discord interactions.
#[derive(Debug, Clone)]
pub struct GuildMember {
    pub id: String,
    pub guild_id: String,
    pub username: String,
    pub joined_at: Option<DateTime<Utc>>,
}
