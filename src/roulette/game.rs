use firestore::FirestoreDb;
use serde::{Deserialize, Serialize};

use crate::discord::helpers::bgr_label;
use crate::discord::types::GuildMember;
use crate::games::lottery::{Lottery, PersistedPlayer};
use crate::jobs::JobType;
use crate::roulette::store::{RouletteLottery, RouletteStore};
use crate::users::UserStore;

pub const ROULETTE_TIME_SECONDS: u64 = 30;
pub const ROULETTE_TIME_MS: u64 = ROULETTE_TIME_SECONDS * 1000;

#[derive(Debug, Serialize, Deserialize)]
pub struct RouletteJobPayload {
    pub id: String,
    pub interaction_token: String,
}

pub struct Roulette {
    pub lottery: RouletteLottery,
    store: RouletteStore,
}

impl Roulette {
    pub fn init(db: FirestoreDb, creator: &GuildMember, bet: i64) -> anyhow::Result<Self> {
        let stored_creator = PersistedPlayer::from(creator);
        let mut lottery = Lottery::new(stored_creator.clone(), bet)?;
        lottery.add_player(stored_creator);
        Ok(Self {
            lottery,
            store: RouletteStore::new(db),
        })
    }

    pub async fn load(db: FirestoreDb, id: &str) -> anyhow::Result<Self> {
        let store = RouletteStore::new(db);
        let lottery = store
            .get(id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Roulette lottery not found"))?;
        Ok(Self { lottery, store })
    }

    pub async fn start(
        &mut self,
        interaction_token: &str,
        job_queue: &crate::jobs::JobQueue,
    ) -> anyhow::Result<String> {
        let start_time = self.lottery.start();

        self.store.put(&self.lottery).await?;

        let payload = RouletteJobPayload {
            id: self.lottery.id.clone(),
            interaction_token: interaction_token.to_string(),
        };

        job_queue
            .enqueue(
                JobType::RouletteFinish,
                serde_json::to_value(&payload)?,
                ROULETTE_TIME_SECONDS,
            )
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

    pub fn start_time(&self) -> Option<&String> {
        self.lottery.start_time.as_ref()
    }

    pub async fn add_player(&mut self, player: &GuildMember) -> anyhow::Result<()> {
        let stored = PersistedPlayer::from(player);
        self.lottery.add_player(stored);
        self.store
            .set_players(&self.lottery.id, &self.lottery.players)
            .await?;
        Ok(())
    }

    pub async fn finish(&self, user_store: &UserStore) -> anyhow::Result<String> {
        if !self.lottery.can_finish() {
            // Refund all players since the game didn't happen
            let refunds: Vec<(GuildMember, i64)> = self
                .lottery
                .players
                .iter()
                .map(|p| (GuildMember::from(p), self.lottery.bet))
                .collect();
            user_store.increment_user_reps(&refunds).await?;

            self.store.delete(&self.lottery.id).await?;
            let creator_name = &self.lottery.creator.username;
            return Ok(format!(
                "{creator_name}'s roulette game was cancelled, not enough players joined."
            ));
        }

        let result = self.lottery.finish();
        let names: Vec<&str> = self
            .lottery
            .players
            .iter()
            .map(|p| p.username.as_str())
            .collect();

        // Players already paid at join time, so only credit the winner the full pot
        let winner_member = GuildMember::from(&result.winner);
        user_store
            .increment_user_rep(&winner_member, self.lottery.pot_size())
            .await?;

        self.store.delete(&self.lottery.id).await?;

        let bet_label = bgr_label(self.bet(), false);
        let pot_label = bgr_label(self.lottery.pot_size(), false);
        let player_names = names.join(", ");
        let winner_name = &result.winner.username;
        Ok(format!(
            "The roulette game has ended. {player_names} all bet {bet_label}. {winner_name} won {pot_label}"
        ))
    }
}
