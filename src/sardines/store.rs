use crate::firebase::FirestoreStore;
use crate::games::lottery::{DbPlayer, Lottery};
use firestore::*;

const COLLECTION: &str = "sardines";

/// Trait abstracting sardines-store operations, enabling mock implementations in tests.
#[async_trait::async_trait]
pub trait SardinesStoreApi: Send + Sync {
    async fn get(&self, id: &str) -> anyhow::Result<Option<SardinesLottery>>;
    async fn put(&self, lottery: &SardinesLottery) -> anyhow::Result<()>;
    async fn delete(&self, id: &str) -> anyhow::Result<()>;
    // async fn list_all(&self) -> anyhow::Result<Vec<SardinesLottery>>;
    async fn set_players(&self, id: &str, players: &[DbPlayer]) -> anyhow::Result<()>;
}

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

#[async_trait::async_trait]
impl SardinesStoreApi for SardinesStore {
    async fn get(&self, id: &str) -> anyhow::Result<Option<SardinesLottery>> {
        self.get(id).await
    }

    async fn put(&self, lottery: &SardinesLottery) -> anyhow::Result<()> {
        self.put(lottery).await
    }

    async fn delete(&self, id: &str) -> anyhow::Result<()> {
        self.delete(id).await
    }

    // async fn list_all(&self) -> anyhow::Result<Vec<SardinesLottery>> {
    //     self.list_all().await
    // }

    async fn set_players(&self, id: &str, players: &[DbPlayer]) -> anyhow::Result<()> {
        self.set_players(id, players).await
    }
}
