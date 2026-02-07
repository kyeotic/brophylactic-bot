use std::sync::Arc;

use poise::serenity_prelude as serenity;
use tokio::sync::RwLock;

use crate::config::Config;
use crate::jobs::JobQueue;
use crate::users::UserStore;
use firestore::FirestoreDb;

/// Shared application state passed to all command handlers via poise's Data.
pub struct AppContext {
    pub config: Config,
    pub db: FirestoreDb,
    pub http: Arc<serenity::Http>,
    pub user_store: UserStore,
    pub job_queue: Arc<RwLock<JobQueue>>,
}

/// poise type aliases
pub type Context<'a> = poise::Context<'a, AppContext, anyhow::Error>;
