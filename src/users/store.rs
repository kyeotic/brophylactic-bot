use chrono::{DateTime, Utc};
use firestore::*;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::discord::types::GuildMember;
use crate::firebase::FirestoreStore;

const COLLECTION: &str = "users";

/// Trait abstracting user-store operations, enabling mock implementations in tests.
#[async_trait::async_trait]
pub trait UserStoreApi: Send + Sync {
    async fn get_user_rep(&self, member: &GuildMember) -> anyhow::Result<i64>;
    async fn increment_user_rep(&self, member: &GuildMember, offset: i64) -> anyhow::Result<()>;
    async fn increment_user_reps(&self, updates: &[(GuildMember, i64)]) -> anyhow::Result<()>;
    async fn get_user_last_guess(
        &self,
        member: &GuildMember,
    ) -> anyhow::Result<Option<DateTime<Utc>>>;
    async fn set_user_last_guess(
        &self,
        member: &GuildMember,
        last_guess_date: DateTime<Utc>,
    ) -> anyhow::Result<()>;
    async fn get_user_last_sardines(
        &self,
        member: &GuildMember,
    ) -> anyhow::Result<Option<DateTime<Utc>>>;
    async fn set_user_last_sardines(
        &self,
        member: &GuildMember,
        last_sardines_date: DateTime<Utc>,
    ) -> anyhow::Result<()>;
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub name: String,
    #[serde(default)]
    #[serde(with = "firestore::serialize_as_optional_timestamp")]
    pub last_guess_date: Option<DateTime<Utc>>,
    #[serde(default)]
    #[serde(with = "firestore::serialize_as_optional_timestamp")]
    pub last_sardines_date: Option<DateTime<Utc>>,
    #[serde(default)]
    pub reputation_offset: i64,
}

#[derive(Clone)]
pub struct UserStore {
    store: FirestoreStore,
}

impl UserStore {
    pub fn new(db: FirestoreDb) -> Self {
        Self {
            store: FirestoreStore::new(db, COLLECTION),
        }
    }

    /// Get a user document, initializing it if it doesn't exist.
    pub async fn get_user(&self, member: &GuildMember) -> anyhow::Result<User> {
        let doc_id = member.doc_id();
        let user: Option<User> = self.store.get(&doc_id).await?;

        match user {
            Some(u) => Ok(u),
            None => self.init_user(member).await,
        }
    }

    /// Initialize a user document with default values.
    async fn init_user(&self, member: &GuildMember) -> anyhow::Result<User> {
        let doc_id = member.doc_id();
        let user = User {
            name: member.username.clone(),
            last_guess_date: None,
            last_sardines_date: None,
            reputation_offset: 0,
        };

        debug!(doc_id, "Initializing new user document");
        self.store.put(&doc_id, &user).await?;

        Ok(user)
    }

    /// Get a user's total reputation (base from join date + offset).
    pub async fn get_user_rep(&self, member: &GuildMember) -> anyhow::Result<i64> {
        let base_rep = calculate_rep_from_joined_date(member);
        let user = self.get_user(member).await?;
        Ok(base_rep + user.reputation_offset)
    }

    /// Atomically increment a single user's reputation offset.
    pub async fn increment_user_rep(
        &self,
        member: &GuildMember,
        offset: i64,
    ) -> anyhow::Result<()> {
        self.increment_user_reps(&[(member.clone(), offset)]).await
    }

    /// Atomically increment reputation offsets for multiple users in a single transaction.
    pub async fn increment_user_reps(&self, updates: &[(GuildMember, i64)]) -> anyhow::Result<()> {
        self.store
            .db()
            .run_transaction(|db, tx| {
                let updates = updates.to_vec();
                Box::pin(async move {
                    // Read phase: fetch all users first
                    let mut user_states: Vec<(String, GuildMember, i64, Option<User>)> = Vec::new();
                    for (member, offset) in &updates {
                        let doc_id = member.doc_id();
                        let existing: Option<User> = db
                            .fluent()
                            .select()
                            .by_id_in(COLLECTION)
                            .obj()
                            .one(&doc_id)
                            .await?;
                        user_states.push((doc_id, member.clone(), *offset, existing));
                    }

                    // Write phase: update only reputation_offset (and name) for existing users,
                    // or create the full document for new users
                    for (doc_id, member, offset, existing) in &user_states {
                        match existing {
                            Some(user) => {
                                let updated = User {
                                    reputation_offset: user.reputation_offset + offset,
                                    name: member.username.clone(),
                                    ..user.clone()
                                };
                                db.fluent()
                                    .update()
                                    .fields(paths_camel_case!(User::reputation_offset, User::name))
                                    .in_col(COLLECTION)
                                    .document_id(doc_id)
                                    .object(&updated)
                                    .add_to_transaction(tx)?;
                            }
                            None => {
                                let new_user = User {
                                    name: member.username.clone(),
                                    last_guess_date: None,
                                    last_sardines_date: None,
                                    reputation_offset: *offset,
                                };
                                db.fluent()
                                    .update()
                                    .in_col(COLLECTION)
                                    .document_id(doc_id)
                                    .object(&new_user)
                                    .add_to_transaction(tx)?;
                            }
                        }
                    }

                    Ok(())
                })
            })
            .await?;

        Ok(())
    }

    /// Get the user's last guess date.
    pub async fn get_user_last_guess(
        &self,
        member: &GuildMember,
    ) -> anyhow::Result<Option<DateTime<Utc>>> {
        let user = self.get_user(member).await?;
        Ok(user.last_guess_date)
    }

    /// Set the user's last guess date.
    pub async fn set_user_last_guess(
        &self,
        member: &GuildMember,
        last_guess_date: DateTime<Utc>,
    ) -> anyhow::Result<()> {
        let doc_id = member.doc_id();
        let user = self.get_user(member).await?;
        let updated = User {
            last_guess_date: Some(last_guess_date),
            name: member.username.clone(),
            ..user
        };
        self.store
            .db()
            .fluent()
            .update()
            .fields(paths_camel_case!(User::last_guess_date, User::name))
            .in_col(COLLECTION)
            .document_id(&doc_id)
            .object(&updated)
            .execute::<()>()
            .await?;
        Ok(())
    }

    /// Get the user's last sardines date.
    pub async fn get_user_last_sardines(
        &self,
        member: &GuildMember,
    ) -> anyhow::Result<Option<DateTime<Utc>>> {
        let user = self.get_user(member).await?;
        Ok(user.last_sardines_date)
    }

    /// Set the user's last sardines date.
    pub async fn set_user_last_sardines(
        &self,
        member: &GuildMember,
        last_sardines_date: DateTime<Utc>,
    ) -> anyhow::Result<()> {
        let doc_id = member.doc_id();
        let user = self.get_user(member).await?;
        let updated = User {
            last_sardines_date: Some(last_sardines_date),
            name: member.username.clone(),
            ..user
        };
        self.store
            .db()
            .fluent()
            .update()
            .fields(paths_camel_case!(User::last_sardines_date, User::name))
            .in_col(COLLECTION)
            .document_id(&doc_id)
            .object(&updated)
            .execute::<()>()
            .await?;
        Ok(())
    }
}

#[async_trait::async_trait]
impl UserStoreApi for UserStore {
    async fn get_user_rep(&self, member: &GuildMember) -> anyhow::Result<i64> {
        self.get_user_rep(member).await
    }

    async fn increment_user_rep(&self, member: &GuildMember, offset: i64) -> anyhow::Result<()> {
        self.increment_user_rep(member, offset).await
    }

    async fn increment_user_reps(&self, updates: &[(GuildMember, i64)]) -> anyhow::Result<()> {
        self.increment_user_reps(updates).await
    }

    async fn get_user_last_guess(
        &self,
        member: &GuildMember,
    ) -> anyhow::Result<Option<DateTime<Utc>>> {
        self.get_user_last_guess(member).await
    }

    async fn set_user_last_guess(
        &self,
        member: &GuildMember,
        last_guess_date: DateTime<Utc>,
    ) -> anyhow::Result<()> {
        self.set_user_last_guess(member, last_guess_date).await
    }

    async fn get_user_last_sardines(
        &self,
        member: &GuildMember,
    ) -> anyhow::Result<Option<DateTime<Utc>>> {
        self.get_user_last_sardines(member).await
    }

    async fn set_user_last_sardines(
        &self,
        member: &GuildMember,
        last_sardines_date: DateTime<Utc>,
    ) -> anyhow::Result<()> {
        self.set_user_last_sardines(member, last_sardines_date).await
    }
}

/// Calculate base reputation from how many days since the member joined the guild.
fn calculate_rep_from_joined_date(member: &GuildMember) -> i64 {
    match member.joined_at {
        Some(joined) => {
            let duration = Utc::now() - joined;
            duration.num_days()
        }
        None => 0,
    }
}
