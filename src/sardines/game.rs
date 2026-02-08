use firestore::FirestoreDb;

use crate::config::Config;
use crate::discord::helpers::{bgr_label, mention};
use crate::discord::types::GuildMember;
use crate::games::lottery::{Lottery, PersistedPlayer};
use crate::sardines::store::{SardinesLottery, SardinesStore};
use crate::users::UserStore;
use crate::util::random::seeded_weighted_random_element;

const A: f64 = 0.4;
const B: f64 = 0.3;
const C: f64 = 1.8;

const PAYOUT_MULTIPLIERS: [f64; 5] = [1.2, 1.5, 1.8, 2.0, 2.5];

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
    store: SardinesStore,
    user_store: UserStore,
    random_seed: String,
}

impl Sardines {
    pub fn init(
        db: FirestoreDb,
        config: &Config,
        user_store: UserStore,
        creator: &GuildMember,
        bet: i64,
    ) -> anyhow::Result<Self> {
        let stored_creator = PersistedPlayer::from(creator);
        let mut lottery = Lottery::new(stored_creator.clone(), bet)?;
        lottery.add_player(stored_creator);
        Ok(Self {
            lottery,
            store: SardinesStore::new(db),
            user_store,
            random_seed: config.random_seed.clone(),
        })
    }

    pub async fn load(
        db: FirestoreDb,
        config: &Config,
        user_store: UserStore,
        id: &str,
    ) -> anyhow::Result<Self> {
        let store = SardinesStore::new(db);
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

    pub async fn start(&mut self) -> anyhow::Result<String> {
        let start_time = self.lottery.start();
        self.store.put(&self.lottery).await?;

        // Immediately deduct creator's bet
        let creator = GuildMember::from(&self.lottery.creator);
        self.user_store
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

    pub fn creator(&self) -> &PersistedPlayer {
        &self.lottery.creator
    }

    pub fn players(&self) -> &[PersistedPlayer] {
        &self.lottery.players
    }

    pub fn can_join_repeat(&self, config: &Config) -> bool {
        self.lottery.players.len() >= config.min_players_before_rejoin
    }

    /// Check if the next player can be added without ending the game.
    /// Returns true if the game continues, false if the joiner "loses".
    pub fn can_add_player(&self) -> bool {
        // Length is all players, but joiners should not count the creator
        // So do not add one to check the incoming player, just leave it at length
        !does_player_lose(self.lottery.players.len())
    }

    pub async fn add_player(&mut self, player: &GuildMember) -> anyhow::Result<()> {
        let stored = PersistedPlayer::from(player);
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

    /// Total pot across all bettors, including the loser who triggered game end.
    /// The +1 accounts for the loser, who is not in `players` but still paid the buy-in.
    fn pot_size(&self) -> i64 {
        self.lottery.bet * (self.lottery.players.len() as i64 + 1)
    }

    /// Get the payout multiplier using weighted random seeded by lottery ID.
    fn get_multiplier(&self) -> f64 {
        *seeded_weighted_random_element(&PAYOUT_MULTIPLIERS, &self.lottery.id, &self.random_seed)
    }

    /// Get the winner's payout: pot_size * multiplier.
    fn get_payout(&self) -> i64 {
        (self.pot_size() as f64 * self.get_multiplier()).floor() as i64
    }

    pub async fn finish(&self, loser: &GuildMember) -> anyhow::Result<String> {
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
                        format!("{name} (x{count})")
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

        self.user_store.increment_user_reps(&updates).await?;
        self.store.delete(&self.lottery.id).await?;

        let creator_name = &self.lottery.creator.username;
        let loser_name = &loser.username;
        let winner_mention = mention(&winner.id);
        let payout_label = bgr_label(payout, false);
        let multiplier_pct = multiplier * 100.0;
        let bettor_names = unique_names.join(", ");
        let bet_label = bgr_label(self.bet(), false);
        let pot_label = bgr_label(self.pot_size(), false);

        Ok(format!(
            "The sardines game started by {creator_name} was ended by {loser_name} failing to join. They were still charged.\n{winner_mention} won {payout_label} with a payout multiplier of **{multiplier_pct:.0}%**.\n\n{bettor_names} all bet {bet_label} for a total pot of {pot_label}."
        ))
    }
}
