use chrono::{DateTime, Utc};
use firestore::*;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::discord::types::GuildMember;

const COLLECTION: &str = "users";
const DELIMITER: char = '.';

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
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
    db: FirestoreDb,
}

impl UserStore {
    pub fn new(db: FirestoreDb) -> Self {
        Self { db }
    }

    /// Get a user document, initializing it if it doesn't exist.
    pub async fn get_user(&self, member: &GuildMember) -> anyhow::Result<User> {
        let doc_id = get_id(member);
        let user: Option<User> = self
            .db
            .fluent()
            .select()
            .by_id_in(COLLECTION)
            .obj()
            .one(&doc_id)
            .await?;

        match user {
            Some(u) => Ok(u),
            None => self.init_user(member).await,
        }
    }

    /// Initialize a user document with default values.
    async fn init_user(&self, member: &GuildMember) -> anyhow::Result<User> {
        let doc_id = get_id(member);
        let user = User {
            id: doc_id.clone(),
            name: member.username.clone(),
            last_guess_date: None,
            last_sardines_date: None,
            reputation_offset: 0,
        };

        debug!(doc_id, "Initializing new user document");

        self.db
            .fluent()
            .insert()
            .into(COLLECTION)
            .document_id(&doc_id)
            .object(&user)
            .execute::<()>()
            .await?;

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
        self.db
            .run_transaction(|db, tx| {
                let updates = updates.to_vec();
                Box::pin(async move {
                    // Read phase: fetch all users first
                    let mut user_states: Vec<(String, GuildMember, i64, Option<User>)> = Vec::new();
                    for (member, offset) in &updates {
                        let doc_id = get_id(member);
                        let existing: Option<User> = db
                            .fluent()
                            .select()
                            .by_id_in(COLLECTION)
                            .obj()
                            .one(&doc_id)
                            .await?;
                        user_states.push((doc_id, member.clone(), *offset, existing));
                    }

                    // Write phase: update all users
                    for (doc_id, member, offset, existing) in &user_states {
                        let current_offset =
                            existing.as_ref().map(|u| u.reputation_offset).unwrap_or(0);
                        let updated = User {
                            id: doc_id.clone(),
                            name: member.username.clone(),
                            last_guess_date: existing.as_ref().and_then(|u| u.last_guess_date),
                            last_sardines_date: existing
                                .as_ref()
                                .and_then(|u| u.last_sardines_date),
                            reputation_offset: current_offset + offset,
                        };

                        db.fluent()
                            .update()
                            .in_col(COLLECTION)
                            .document_id(doc_id)
                            .object(&updated)
                            .add_to_transaction(tx)?;
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
        let doc_id = get_id(member);
        let user = self.get_user(member).await?;
        let updated = User {
            last_guess_date: Some(last_guess_date),
            name: member.username.clone(),
            ..user
        };
        self.db
            .fluent()
            .update()
            .fields(paths!(User::last_guess_date, User::name))
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
        let doc_id = get_id(member);
        let user = self.get_user(member).await?;
        let updated = User {
            last_sardines_date: Some(last_sardines_date),
            name: member.username.clone(),
            ..user
        };
        self.db
            .fluent()
            .update()
            .fields(paths!(User::last_sardines_date, User::name))
            .in_col(COLLECTION)
            .document_id(&doc_id)
            .object(&updated)
            .execute::<()>()
            .await?;
        Ok(())
    }
}

/// Build the Firestore document ID: "{guild_id}.{user_id}"
fn get_id(member: &GuildMember) -> String {
    format!("{}{}{}", member.guild_id, DELIMITER, member.id)
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
