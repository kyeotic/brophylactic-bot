use std::fmt;
use std::str::FromStr;

use chrono::{DateTime, Utc};
use serenity::all::{GuildId, Timestamp, User};
use tracing::info;

/// Types of button interactions dispatched via component custom IDs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InteractionType {
    Debug,
    Roulette,
    Sardines,
}

impl fmt::Display for InteractionType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Debug => write!(f, "DEBUG"),
            Self::Roulette => write!(f, "ROULETTE"),
            Self::Sardines => write!(f, "SARDINES"),
        }
    }
}

impl FromStr for InteractionType {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "DEBUG" => Ok(Self::Debug),
            "ROULETTE" => Ok(Self::Roulette),
            "SARDINES" => Ok(Self::Sardines),
            other => Err(anyhow::anyhow!("Unknown interaction type: {other}")),
        }
    }
}

/// Simplified guild member info extracted from Discord interactions.
#[derive(Debug, Clone)]
pub struct GuildMember {
    pub id: String,
    pub guild_id: String,
    pub username: String,
    pub joined_at: Option<DateTime<Utc>>,
}

impl GuildMember {
    /// Convert serenity types into our GuildMember type.
    /// Firestore document ID: "{guild_id}.{user_id}"
    pub fn doc_id(&self) -> String {
        format!("{}.{}", self.guild_id, self.id)
    }

    /// Convert serenity types into our GuildMember type.
    /// Uses the server nickname if available, falling back to the account name.
    pub fn from_serenity(
        guild_id: GuildId,
        user: &User,
        joined_at: Option<Timestamp>,
        nick: Option<&str>,
    ) -> Self {
        let display_name = nick
            .map(|n| n.to_string())
            .or_else(|| user.global_name.clone())
            .unwrap_or_else(|| user.name.clone());
        info!(
            "Creating GuildMember from user {} in guild {}",
            user, guild_id
        );
        Self {
            id: user.id.to_string(),
            guild_id: guild_id.to_string(),
            username: display_name,
            joined_at: joined_at.and_then(|ts| DateTime::from_timestamp(ts.unix_timestamp(), 0)),
        }
    }
}
