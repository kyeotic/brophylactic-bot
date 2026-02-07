use firestore::FirestoreDb;

use crate::config::Config;
use crate::discord::helpers::{bgr_label, mention};
use crate::discord::types::GuildMember;
use crate::games::lottery::{Lottery, StoredPlayer};
use crate::sardines::store::{SardinesLottery, SardinesStore};
use crate::users::UserStore;
use crate::util::random::seeded_weighted_random;

const A: f64 = 0.4;
const B: f64 = 0.3;
const C: f64 = 1.8;

const PAYOUT_MULTIPLIERS: [f64; 5] = [1.2, 1.5, 1.8, 2.0, 2.5];

pub fn min_players_before_rejoin(config: &Config) -> usize {
    if config.stage == "local" || config.stage == "dev" {
        1
    } else {
        4
    }
}

/// Calculate the chance that a joining player ends the game.
/// n = current number of players in the game.
pub fn join_failure_chance(n: usize) -> f64 {
    let n = n as f64;
    // TS: 1 - (A - n + B) / (n + C) - 1 = -(A - n + B) / (n + C) = -(0.7 - n) / (n + 1.8)
    -((A - n + B) / (n + C))
}

fn does_player_lose(n: usize) -> bool {
    let chance = join_failure_chance(n);
    rand::random::<f64>() < chance
}

pub struct Sardines {
    pub lottery: SardinesLottery,
    store: SardinesStore,
    bot_token: String,
}

impl Sardines {
    pub fn init(
        db: &FirestoreDb,
        config: &Config,
        creator: &GuildMember,
        bet: i64,
    ) -> anyhow::Result<Self> {
        let stored_creator = StoredPlayer::from(creator);
        let mut lottery = Lottery::new(stored_creator.clone(), bet)?;
        lottery.add_player(stored_creator);
        Ok(Self {
            lottery,
            store: SardinesStore::new(db.clone()),
            bot_token: config.discord.bot_token.clone(),
        })
    }

    pub async fn load(db: &FirestoreDb, config: &Config, id: &str) -> anyhow::Result<Self> {
        let store = SardinesStore::new(db.clone());
        let lottery = store
            .get(id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Sardines lottery not found"))?;
        Ok(Self {
            lottery,
            store,
            bot_token: config.discord.bot_token.clone(),
        })
    }

    pub async fn start(&mut self, user_store: &UserStore) -> anyhow::Result<String> {
        let start_time = self.lottery.start();
        self.store.put(&self.lottery).await?;

        // Immediately deduct creator's bet
        let creator = GuildMember::from(&self.lottery.creator);
        user_store
            .increment_user_rep(&creator, -self.lottery.bet)
            .await?;

        Ok(start_time)
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

    pub fn creator(&self) -> &StoredPlayer {
        &self.lottery.creator
    }

    pub fn players(&self) -> &[StoredPlayer] {
        &self.lottery.players
    }

    pub fn can_join_repeat(&self, config: &Config) -> bool {
        self.lottery.players.len() >= min_players_before_rejoin(config)
    }

    /// Check if the next player can be added without ending the game.
    /// Returns true if the game continues, false if the joiner "loses".
    pub fn can_add_player(&self) -> bool {
        // Length is all players, but joiners should not count the creator
        // So do not add one to check the incoming player, just leave it at length
        !does_player_lose(self.lottery.players.len())
    }

    pub async fn add_player(
        &mut self,
        player: &GuildMember,
        user_store: &UserStore,
    ) -> anyhow::Result<()> {
        let stored = StoredPlayer::from(player);
        self.lottery.add_player(stored);
        self.store
            .set_players(&self.lottery.id, &self.lottery.players)
            .await?;

        // Immediately deduct buy-in
        user_store
            .increment_user_rep(player, -self.lottery.bet)
            .await?;
        Ok(())
    }

    /// Pot size includes the loser (players + 1 for the loser who triggered game end).
    fn pot_size(&self) -> i64 {
        self.lottery.bet * (self.lottery.players.len() as i64 + 1)
    }

    /// Get the payout multiplier using weighted random seeded by lottery ID.
    fn get_multiplier(&self) -> f64 {
        let idx =
            seeded_weighted_random(1, PAYOUT_MULTIPLIERS.len() as i64, &self.lottery.id, &self.bot_token)
                as usize
                - 1;
        PAYOUT_MULTIPLIERS[idx.min(PAYOUT_MULTIPLIERS.len() - 1)]
    }

    /// Get the winner's payout: pot_size * multiplier.
    fn get_payout(&self) -> i64 {
        (self.pot_size() as f64 * self.get_multiplier()).floor() as i64
    }

    pub async fn finish(
        &self,
        loser: &GuildMember,
        user_store: &UserStore,
    ) -> anyhow::Result<String> {
        // Pick a random winner from existing players
        let result = self.lottery.finish();
        let winner = &result.winner;
        let payout = self.get_payout();
        let multiplier = self.get_multiplier();

        // Build the bettor name list (players + loser)
        let mut bettors: Vec<String> = self
            .lottery
            .players
            .iter()
            .map(|p| p.username.clone())
            .collect();
        bettors.push(loser.username.clone());

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
                        format!("{} (x{})", name, count)
                    } else {
                        name.clone()
                    }
                })
                .collect()
        };

        // Apply payouts: winner gets payout, loser pays bet
        let mut updates: Vec<(GuildMember, i64)> = vec![
            (GuildMember::from(winner), payout),
            (loser.clone(), -self.lottery.bet),
        ];

        // If winner is also the loser, merge the updates
        if winner.id == loser.id {
            let net = payout - self.lottery.bet;
            updates = vec![(loser.clone(), net)];
        }

        user_store.increment_user_reps(&updates).await?;
        self.store.delete(&self.lottery.id).await?;

        Ok(format!(
            "The sardines game started by {} was ended by {} failing to join. They were still charged.\n{} won {} with a payout multiplier of **{:.0}%**.\n\n{} all bet {} for a total pot of {}.",
            self.lottery.creator.username,
            loser.username,
            mention(&winner.id),
            bgr_label(payout, false),
            multiplier * 100.0,
            unique_names.join(", "),
            bgr_label(self.bet(), false),
            bgr_label(self.pot_size(), false),
        ))
    }
}
