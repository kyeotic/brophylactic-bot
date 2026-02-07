use firestore::*;

use crate::games::lottery::{Lottery, StoredPlayer};

const COLLECTION: &str = "lotteries";

pub type RouletteLottery = Lottery<StoredPlayer>;

pub struct RouletteStore {
    db: FirestoreDb,
}

impl RouletteStore {
    pub fn new(db: FirestoreDb) -> Self {
        Self { db }
    }

    pub async fn get(&self, id: &str) -> anyhow::Result<Option<RouletteLottery>> {
        let lottery: Option<RouletteLottery> = self
            .db
            .fluent()
            .select()
            .by_id_in(COLLECTION)
            .obj()
            .one(id)
            .await?;
        Ok(lottery)
    }

    pub async fn put(&self, lottery: &RouletteLottery) -> anyhow::Result<()> {
        self.db
            .fluent()
            .insert()
            .into(COLLECTION)
            .document_id(&lottery.id)
            .object(lottery)
            .execute::<()>()
            .await?;
        Ok(())
    }

    pub async fn delete(&self, id: &str) -> anyhow::Result<()> {
        self.db
            .fluent()
            .delete()
            .from(COLLECTION)
            .document_id(id)
            .execute()
            .await?;
        Ok(())
    }

    pub async fn set_players(&self, id: &str, players: &[StoredPlayer]) -> anyhow::Result<()> {
        // Update the full lottery document with new players
        let lottery = self.get(id).await?;
        if let Some(mut lottery) = lottery {
            lottery.players = players.to_vec();
            self.db
                .fluent()
                .update()
                .in_col(COLLECTION)
                .document_id(id)
                .object(&lottery)
                .execute::<()>()
                .await?;
        }
        Ok(())
    }
}
