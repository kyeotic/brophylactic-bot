use crate::firebase::FirestoreStore;
use crate::games::lottery::{DbPlayer, Lottery};
use firestore::*;

const COLLECTION: &str = "sardines";

pub type SardinesLottery = Lottery<DbPlayer>;

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

    pub async fn list_all(&self) -> anyhow::Result<Vec<SardinesLottery>> {
        self.store.list_all().await
    }

    pub async fn set_players(&self, id: &str, players: &[DbPlayer]) -> anyhow::Result<()> {
        let id = id.to_string();
        let players = players.to_vec();
        self.store
            .db()
            .run_transaction(|db, tx| {
                let id = id.clone();
                let players = players.clone();
                Box::pin(async move {
                    let lottery: Option<SardinesLottery> = db
                        .fluent()
                        .select()
                        .by_id_in(COLLECTION)
                        .obj()
                        .one(&id)
                        .await?;

                    if let Some(mut lottery) = lottery {
                        lottery.players = players;
                        db.fluent()
                            .update()
                            .in_col(COLLECTION)
                            .document_id(&id)
                            .object(&lottery)
                            .add_to_transaction(tx)?;
                    }
                    Ok(())
                })
            })
            .await?;
        Ok(())
    }
}
