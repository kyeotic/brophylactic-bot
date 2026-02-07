use nanoid::nanoid;
use serde::{Deserialize, Serialize};

use crate::discord::types::GuildMember;
use crate::util::random::random_inclusive;

/// Serializable player type for lottery persistence in Firestore.
/// Uses String for joined_at (not DateTime) to match existing Firestore data format.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredPlayer {
    pub id: String,
    pub guild_id: String,
    pub username: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub joined_at: Option<String>,
}

impl From<&GuildMember> for StoredPlayer {
    fn from(m: &GuildMember) -> Self {
        StoredPlayer {
            id: m.id.clone(),
            guild_id: m.guild_id.clone(),
            username: m.username.clone(),
            joined_at: m.joined_at.map(|d| d.to_rfc3339()),
        }
    }
}

impl From<&StoredPlayer> for GuildMember {
    fn from(p: &StoredPlayer) -> Self {
        GuildMember {
            id: p.id.clone(),
            guild_id: p.guild_id.clone(),
            username: p.username.clone(),
            joined_at: p.joined_at.as_ref().and_then(|s| s.parse().ok()),
        }
    }
}

/// A generic lottery/gambling game. Players join by paying a bet,
/// and a random winner takes the pot.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lottery<Player: Clone + PartialEq> {
    pub id: String,
    pub bet: i64,
    pub creator: Player,
    pub players: Vec<Player>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_time: Option<String>,
}

pub struct LotteryResult<Player> {
    pub winner: Player,
    pub payouts: Vec<(Player, i64)>,
}

impl<Player: Clone + PartialEq> Lottery<Player> {
    pub fn new(creator: Player, bet: i64) -> anyhow::Result<Self> {
        if bet <= 0 {
            anyhow::bail!("bet cannot be less than or equal to 0");
        }

        Ok(Self {
            id: nanoid!(),
            bet,
            creator,
            players: Vec::new(),
            start_time: None,
        })
    }

    /// Restore a lottery from persisted data.
    pub fn from_parts(
        id: String,
        creator: Player,
        bet: i64,
        players: Vec<Player>,
        start_time: Option<String>,
    ) -> Self {
        Self {
            id,
            bet,
            creator,
            players,
            start_time,
        }
    }

    pub fn buy_in(&self) -> i64 {
        self.bet
    }

    /// The pot is bet * number of players (the total money at stake).
    pub fn pot_size(&self) -> i64 {
        self.bet * self.players.len() as i64
    }

    /// Record the start time (idempotent).
    pub fn start(&mut self) -> String {
        if let Some(ref t) = self.start_time {
            return t.clone();
        }
        let now = chrono::Utc::now().to_rfc3339();
        self.start_time = Some(now.clone());
        now
    }

    pub fn add_player(&mut self, player: Player) {
        self.players.push(player);
    }

    /// A lottery can finish only with more than 1 player.
    pub fn can_finish(&self) -> bool {
        self.players.len() > 1
    }

    /// The winner's payout: bet * (n - 1) because they don't pay themselves.
    pub fn get_payout(&self) -> i64 {
        self.bet.abs() * (self.players.len() as i64 - 1)
    }

    /// Finish the lottery: pick a random winner and compute payouts.
    /// Winners receive `bet * (n-1)`, losers receive `-bet`.
    pub fn finish(&self) -> LotteryResult<Player> {
        let idx = random_inclusive(0, self.players.len() as i64 - 1) as usize;
        let winner = self.players[idx].clone();

        let payouts = self
            .players
            .iter()
            .map(|player| {
                let amount = if player == &winner {
                    self.get_payout()
                } else {
                    -self.bet
                };
                (player.clone(), amount)
            })
            .collect();

        LotteryResult { winner, payouts }
    }
}
