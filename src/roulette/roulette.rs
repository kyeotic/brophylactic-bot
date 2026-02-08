use firestore::FirestoreDb;
use serde::{Deserialize, Serialize};

use crate::discord::helpers::bgr_label;
use crate::discord::types::GuildMember;
use crate::games::lottery::{Lottery, StoredPlayer};
use crate::jobs::JobType;
use crate::roulette::store::{RouletteStore, RouletteLottery};
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
    pub fn init(
        db: &FirestoreDb,
        creator: &GuildMember,
        bet: i64,
    ) -> anyhow::Result<Self> {
        let stored_creator = StoredPlayer::from(creator);
        let mut lottery = Lottery::new(stored_creator.clone(), bet)?;
        lottery.add_player(stored_creator);
        Ok(Self {
            lottery,
            store: RouletteStore::new(db.clone()),
        })
    }

    pub async fn load(db: &FirestoreDb, id: &str) -> anyhow::Result<Self> {
        let store = RouletteStore::new(db.clone());
        let lottery = store
            .get(id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Roulette lottery not found"))?;
        Ok(Self { lottery, store })
    }

    pub async fn start(&mut self, interaction_token: &str, job_queue: &crate::jobs::JobQueue) -> anyhow::Result<String> {
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

    pub fn creator(&self) -> &StoredPlayer {
        &self.lottery.creator
    }

    pub fn players(&self) -> &[StoredPlayer] {
        &self.lottery.players
    }

    pub fn start_time(&self) -> Option<&String> {
        self.lottery.start_time.as_ref()
    }

    pub async fn add_player(&mut self, player: &GuildMember) -> anyhow::Result<()> {
        let stored = StoredPlayer::from(player);
        self.lottery.add_player(stored);
        self.store
            .set_players(&self.lottery.id, &self.lottery.players)
            .await?;
        Ok(())
    }

    pub async fn finish(&self, user_store: &UserStore) -> anyhow::Result<String> {
        if !self.lottery.can_finish() {
            self.store.delete(&self.lottery.id).await?;
            return Ok(format!(
                "{}'s roulette game was cancelled, not enough players joined.",
                self.lottery.creator.username
            ));
        }

        let result = self.lottery.finish();
        let names: Vec<&str> = result.payouts.iter().map(|(p, _)| p.username.as_str()).collect();

        // Convert payouts to GuildMember + offset pairs for user store
        let updates: Vec<(GuildMember, i64)> = result
            .payouts
            .iter()
            .map(|(p, offset)| (GuildMember::from(p), *offset))
            .collect();

        user_store.increment_user_reps(&updates).await?;

        self.store.delete(&self.lottery.id).await?;

        Ok(format!(
            "The roulette game has ended. {} all bet {}. {} won {}",
            names.join(", "),
            bgr_label(self.bet(), false),
            result.winner.username,
            bgr_label(self.lottery.pot_size(), false),
        ))
    }
}
