use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use poise::serenity_prelude as serenity;
use tokio::sync::RwLock;

use crate::config::Config;
use crate::jobs::JobQueue;
use crate::users::UserStore;
use firestore::FirestoreDb;

/// Per-game lock to serialize concurrent join operations.
/// Outer Mutex guards the map; inner RwLock guards each game's state.
pub type GameLocks = Arc<Mutex<HashMap<String, Arc<RwLock<()>>>>>;

/// Shared application state passed to all command handlers via poise's Data.
pub struct AppContext {
    pub config: Config,
    pub db: FirestoreDb,
    pub http: Arc<serenity::Http>,
    pub user_store: UserStore,
    pub job_queue: Arc<RwLock<JobQueue>>,
    pub game_locks: GameLocks,
}

/// Get or create a per-game lock for serializing concurrent operations.
pub fn get_game_lock(locks: &GameLocks, game_id: &str) -> Arc<RwLock<()>> {
    let mut map = locks.lock().expect("game locks poisoned");
    map.entry(game_id.to_string())
        .or_insert_with(|| Arc::new(RwLock::new(())))
        .clone()
}

/// Remove a per-game lock after the game is finished.
pub fn remove_game_lock(locks: &GameLocks, game_id: &str) {
    let mut map = locks.lock().expect("game locks poisoned");
    map.remove(game_id);
}

/// poise type aliases
pub type Context<'a> = poise::Context<'a, AppContext, anyhow::Error>;
