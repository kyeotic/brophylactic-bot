use firestore::*;
use serde::{Serialize, de::DeserializeOwned};

/// Generic Firestore document store that encapsulates common CRUD operations.
#[derive(Clone)]
pub struct FirestoreStore {
    db: FirestoreDb,
    collection: &'static str,
}

impl FirestoreStore {
    pub fn new(db: FirestoreDb, collection: &'static str) -> Self {
        Self { db, collection }
    }

    pub fn db(&self) -> &FirestoreDb {
        &self.db
    }

    pub async fn get<T: DeserializeOwned + Send>(&self, id: &str) -> anyhow::Result<Option<T>> {
        let result: Option<T> = self
            .db
            .fluent()
            .select()
            .by_id_in(self.collection)
            .obj()
            .one(id)
            .await?;
        Ok(result)
    }

    pub async fn put<T: Serialize + DeserializeOwned + Sync + Send>(
        &self,
        id: &str,
        obj: &T,
    ) -> anyhow::Result<()> {
        self.db
            .fluent()
            .insert()
            .into(self.collection)
            .document_id(id)
            .object(obj)
            .execute::<()>()
            .await?;
        Ok(())
    }

    pub async fn delete(&self, id: &str) -> anyhow::Result<()> {
        self.db
            .fluent()
            .delete()
            .from(self.collection)
            .document_id(id)
            .execute()
            .await?;
        Ok(())
    }
}
