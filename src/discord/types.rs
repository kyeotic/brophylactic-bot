use std::fmt;
use std::str::FromStr;

use chrono::{DateTime, Utc};
use serenity::all::{GuildId, Timestamp, User};

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
    pub fn from_serenity(guild_id: GuildId, user: &User, joined_at: Option<Timestamp>) -> Self {
        Self {
            id: user.id.to_string(),
            guild_id: guild_id.to_string(),
            username: user.name.clone(),
            joined_at: joined_at.and_then(|ts| DateTime::from_timestamp(ts.unix_timestamp(), 0)),
        }
    }
}
