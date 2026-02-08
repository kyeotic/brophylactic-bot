use crate::firebase::FirestoreStore;
use crate::games::lottery::{Lottery, StoredPlayer};
use firestore::FirestoreDb;

const COLLECTION: &str = "lotteries";

pub type SardinesLottery = Lottery<StoredPlayer>;

pub struct SardinesStore {
    store: FirestoreStore,
}

impl SardinesStore {
    pub fn new(db: FirestoreDb) -> Self {
        Self {
            store: FirestoreStore::new(db, COLLECTION),
        }
    }

    pub async fn get(&self, id: &str) -> anyhow::Result<Option<SardinesLottery>> {
        self.store.get(id).await
    }

    pub async fn put(&self, lottery: &SardinesLottery) -> anyhow::Result<()> {
        self.store.put(&lottery.id, lottery).await
    }

    pub async fn delete(&self, id: &str) -> anyhow::Result<()> {
        self.store.delete(id).await
    }

    pub async fn set_players(&self, id: &str, players: &[StoredPlayer]) -> anyhow::Result<()> {
        let lottery: Option<SardinesLottery> = self.store.get(id).await?;
        if let Some(mut lottery) = lottery {
            lottery.players = players.to_vec();
            self.store.update(id, &lottery).await?;
        }
        Ok(())
    }
}
