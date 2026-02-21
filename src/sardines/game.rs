use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::config::Config;
use crate::discord::helpers::{mention, rep_label};
use crate::discord::types::GuildMember;
use crate::games::lottery::{DbPlayer, Lottery};
use crate::jobs::JobType;
use crate::sardines::store::{SardinesLottery, SardinesStoreApi};
use crate::users::UserStoreApi;
use crate::util::random::seeded_weighted_random_element;

const A: f64 = 0.4;
const B: f64 = 0.3;
const C: f64 = 1.8;

const PAYOUT_MULTIPLIERS: [f64; 5] = [1.2, 1.5, 1.8, 2.0, 2.5];

#[derive(Debug, Serialize, Deserialize)]
pub struct SardinesJobPayload {
    pub id: String,
    pub channel_id: u64,
    pub message_id: u64,
}

/// Calculate the chance that a joining player ends the game.
/// Returns a value between 0.0 and 1.0. At low player counts the chance is small
/// (e.g. ~0% at 1 player), rising steeply through the mid range and approaching
/// 100% asymptotically as the player count grows.
pub fn join_failure_chance(n: usize) -> f64 {
    let n = n as f64;
    -((A - n + B) / (n + C))
}

fn does_player_lose(n: usize) -> bool {
    let chance = join_failure_chance(n);
    rand::random::<f64>() < chance
}

pub struct Sardines {
    pub lottery: SardinesLottery,
    store: Arc<dyn SardinesStoreApi>,
    user_store: Arc<dyn UserStoreApi>,
    random_seed: String,
}

impl Sardines {
    pub fn init(
        store: Arc<dyn SardinesStoreApi>,
        config: &Config,
        user_store: Arc<dyn UserStoreApi>,
        creator: &GuildMember,
        bet: i64,
    ) -> anyhow::Result<Self> {
        let stored_creator = DbPlayer::from(creator);
        let mut lottery = Lottery::new(stored_creator.clone(), bet)?;
        lottery.add_player(stored_creator);
        Ok(Self {
            lottery,
            store,
            user_store,
            random_seed: config.random_seed.clone(),
        })
    }

    pub async fn load(
        store: Arc<dyn SardinesStoreApi>,
        config: &Config,
        user_store: Arc<dyn UserStoreApi>,
        id: &str,
    ) -> anyhow::Result<Self> {
        let lottery = store
            .get(id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Sardines lottery not found"))?;
        Ok(Self {
            lottery,
            store,
            user_store,
            random_seed: config.random_seed.clone(),
        })
    }

    /// Create a Sardines instance from an already-loaded lottery.
    /// Used by recovery to wrap games loaded via list_all().
    pub fn from_lottery(
        store: Arc<dyn SardinesStoreApi>,
        config: &Config,
        user_store: Arc<dyn UserStoreApi>,
        lottery: SardinesLottery,
    ) -> Self {
        Self {
            lottery,
            store,
            user_store,
            random_seed: config.random_seed.clone(),
        }
    }

    /// Save the game to Firestore and deduct the creator's bet.
    pub async fn save(&mut self) -> anyhow::Result<String> {
        let start_time = self.lottery.start();
        self.store.put(&self.lottery).await?;

        // Immediately deduct creator's bet
        let creator = GuildMember::from(&self.lottery.creator);
        self.user_store
            .increment_user_rep(&creator, -self.lottery.bet)
            .await?;

        Ok(start_time)
    }

    /// Enqueue a timeout job to finish the game after expiry.
    pub async fn enqueue_timeout(
        &self,
        channel_id: u64,
        message_id: u64,
        job_queue: &crate::jobs::JobQueue,
        expiry_seconds: u64,
    ) -> anyhow::Result<()> {
        let payload = SardinesJobPayload {
            id: self.lottery.id.clone(),
            channel_id,
            message_id,
        };
        job_queue
            .enqueue(JobType::SardinesFinish, &payload, expiry_seconds)
            .await
    }

    pub fn id(&self) -> &str {
        &self.lottery.id
    }

    pub fn buy_in(&self) -> i64 {
        self.lottery.buy_in()
    }

    pub fn bet(&self) -> i64 {
        self.lottery.bet
    }

    pub fn creator(&self) -> &DbPlayer {
        &self.lottery.creator
    }

    pub fn players(&self) -> &[DbPlayer] {
        &self.lottery.players
    }

    pub fn can_join_repeat(&self, config: &Config) -> bool {
        self.lottery.players.len() >= config.min_players_before_rejoin
    }

    /// Check if the next player can be added without ending the game.
    /// Returns true if the game continues, false if the joiner triggers the end.
    /// Must be called BEFORE add_player so the probability uses the pre-add count.
    pub fn can_add_player(&self) -> bool {
        // Length is all players, but joiners should not count the creator
        // So do not add one to check the incoming player, just leave it at length
        !does_player_lose(self.lottery.players.len())
    }

    pub async fn add_player(&mut self, player: &GuildMember) -> anyhow::Result<()> {
        let stored = DbPlayer::from(player);
        self.lottery.add_player(stored);
        self.store
            .set_players(&self.lottery.id, &self.lottery.players)
            .await?;

        // Immediately deduct buy-in
        self.user_store
            .increment_user_rep(player, -self.lottery.bet)
            .await?;
        Ok(())
    }

    /// Get the payout multiplier using weighted random seeded by lottery ID.
    fn get_multiplier(&self) -> f64 {
        *seeded_weighted_random_element(&PAYOUT_MULTIPLIERS, &self.lottery.id, &self.random_seed)
    }

    /// Get the winner's payout: pot_size * multiplier.
    fn get_payout(&self) -> i64 {
        (self.lottery.pot_size() as f64 * self.get_multiplier()).floor() as i64
    }

    /// Finish the game. If `ended_by` is Some, a player triggered the end by joining;
    /// if None, the game expired via timeout.
    /// All current players are in the winner pool.
    pub async fn finish(&self, ended_by: Option<&str>) -> anyhow::Result<String> {
        let creator_name = &self.lottery.creator.username;

        if !self.lottery.can_finish() {
            // Not enough players — refund everyone
            let refunds: Vec<(GuildMember, i64)> = self
                .lottery
                .players
                .iter()
                .map(|p| (GuildMember::from(p), self.lottery.bet))
                .collect();
            self.user_store.increment_user_reps(&refunds).await?;
            self.store.delete(&self.lottery.id).await?;

            return Ok(format!(
                "{creator_name}'s sardines game has expired. Not enough players joined, all bets refunded."
            ));
        }

        let result = self.lottery.finish();
        let winner = &result.winner;
        let payout = self.get_payout();
        let multiplier = self.get_multiplier();

        // Build the bettor name list from all players
        let bettors: Vec<String> = self
            .lottery
            .players
            .iter()
            .map(|p| p.username.clone())
            .collect();

        // Deduplicate names, showing count for repeats
        let unique_names: Vec<String> = {
            let mut seen = Vec::new();
            for name in &bettors {
                if !seen.contains(name) {
                    seen.push(name.clone());
                }
            }
            seen.iter()
                .map(|name| {
                    let count = bettors.iter().filter(|n| *n == name).count();
                    if count > 1 {
                        format!("{name} (x{count})")
                    } else {
                        name.clone()
                    }
                })
                .collect()
        };

        // Credit the winner with the payout (all bets already deducted at join time)
        let winner_member = GuildMember::from(winner);
        self.user_store
            .increment_user_rep(&winner_member, payout)
            .await?;
        self.store.delete(&self.lottery.id).await?;

        let winner_mention = mention(&winner.id);
        let payout_label = rep_label(payout, false);
        let multiplier_pct = multiplier * 100.0;
        let bettor_names = unique_names.join(", ");
        let bet_label = rep_label(self.bet(), false);
        let pot_label = rep_label(self.lottery.pot_size(), false);

        let ending = match ended_by {
            Some(name) => format!("was ended when {name} joined"),
            None => "has expired".to_string(),
        };

        Ok(format!(
            "The sardines game started by {creator_name} {ending}.\n{winner_mention} won {payout_label} with a payout multiplier of **{multiplier_pct:.0}%**.\n\n{bettor_names} all bet {bet_label} for a total pot of {pot_label}."
        ))
    }
}
