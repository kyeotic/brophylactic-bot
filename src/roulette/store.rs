use crate::firebase::FirestoreStore;
use crate::games::lottery::{DbPlayer, Lottery};
use firestore::*;

const COLLECTION: &str = "roulettes";

pub type RouletteLottery = Lottery<DbPlayer>;

pub struct RouletteStore {
    store: FirestoreStore,
}

impl RouletteStore {
    pub fn new(db: FirestoreDb) -> Self {
        Self {
            store: FirestoreStore::new(db, COLLECTION),
        }
    }

    pub async fn get(&self, id: &str) -> anyhow::Result<Option<RouletteLottery>> {
        self.store.get(id).await
    }

    pub async fn put(&self, lottery: &RouletteLottery) -> anyhow::Result<()> {
        self.store.put(&lottery.id, lottery).await
    }

    pub async fn delete(&self, id: &str) -> anyhow::Result<()> {
        self.store.delete(id).await
    }

    /// Atomically add a player to the lottery inside a Firestore transaction.
    /// Returns the updated player list. Skips the add if the player already exists.
    pub async fn add_player(&self, id: &str, player: &DbPlayer) -> anyhow::Result<Vec<DbPlayer>> {
        let id = id.to_string();
        let player = player.clone();
        let result: Option<Vec<DbPlayer>> = self
            .store
            .db()
            .run_transaction(|db, tx| {
                let id = id.clone();
                let player = player.clone();
                Box::pin(async move {
                    let lottery: Option<RouletteLottery> = db
                        .fluent()
                        .select()
                        .by_id_in(COLLECTION)
                        .obj()
                        .one(&id)
                        .await?;

                    if let Some(mut lottery) = lottery {
                        if !lottery.players.iter().any(|p| p.id == player.id) {
                            lottery.players.push(player);
                        }
                        let players = lottery.players.clone();
                        db.fluent()
                            .update()
                            .in_col(COLLECTION)
                            .document_id(&id)
                            .object(&lottery)
                            .add_to_transaction(tx)?;
                        Ok(Some(players))
                    } else {
                        Ok(None)
                    }
                })
            })
            .await?;
        result.ok_or_else(|| anyhow::anyhow!("Roulette lottery not found"))
    }
}
