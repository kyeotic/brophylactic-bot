mod commands;
mod config;
mod context;
mod discord;
mod firebase;
mod games;
mod jobs;
mod roulette;
mod sardines;
mod users;
mod util;

use std::sync::Arc;

use config::Config;
use context::AppContext;
use firestore::FirestoreDb;
use jobs::{JobQueue, JobType};
use users::UserStore;

use poise::serenity_prelude as serenity;
use tokio::sync::RwLock;
use tracing::{error, info};

use discord::types::InteractionType;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    let log_level = std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string());
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new(&log_level)),
        )
        .init();

    let config = Config::load()?;
    info!("Starting bot");

    // Initialize Firestore
    let db = firebase::client::create_firestore_db(
        &config.firebase.project_id,
        &config.firebase.cert_base64,
    )
    .await?;

    let guild_id = serenity::GuildId::new(config.discord.server_id.parse()?);
    let token = config.discord.bot_token.clone();

    let framework = poise::Framework::builder()
        .options(poise::FrameworkOptions {
            commands: commands::all(),
            pre_command: |ctx| {
                Box::pin(async move {
                    info!(
                        command = ctx.command().name,
                        user = ctx.author().name,
                        "Command invoked"
                    );
                })
            },
            event_handler: |ctx, event, _framework, data| Box::pin(event_handler(ctx, event, data)),
            ..Default::default()
        })
        .setup(move |ctx, _ready, framework| {
            Box::pin(build_app_context(ctx, framework, guild_id, config, db))
        })
        .build();

    let intents = serenity::GatewayIntents::GUILDS | serenity::GatewayIntents::GUILD_MEMBERS;

    let mut client = serenity::ClientBuilder::new(&token, intents)
        .framework(framework)
        .await?;

    client.start().await?;

    Ok(())
}

async fn build_app_context(
    ctx: &serenity::Context,
    framework: &poise::Framework<AppContext, anyhow::Error>,
    guild_id: serenity::GuildId,
    config: Config,
    db: FirestoreDb,
) -> anyhow::Result<AppContext> {
    info!("Successfully connected to gateway");
    poise::builtins::register_in_guild(ctx, &framework.options().commands, guild_id).await?;
    info!("Commands registered");

    let http = ctx.http.clone();
    let user_store = UserStore::new(db.clone());
    let mut job_queue = JobQueue::new(db.clone());

    // Register roulette:finish job handler
    let finish_http = http.clone();
    let finish_db = db.clone();
    let finish_user_store = UserStore::new(db.clone());
    job_queue
        .register(JobType::RouletteFinish, move |payload| {
            let http = finish_http.clone();
            let db = finish_db.clone();
            let user_store = finish_user_store.clone();
            async move {
                roulette::command::finish_roulette(payload, &http, &db, &user_store).await
            }
        })
        .await;

    job_queue.start(config.job_queue_poll_interval_ms);
    let job_queue = Arc::new(RwLock::new(job_queue));

    // Recover any pending roulette countdowns
    roulette::command::recover_countdowns(&db, &http, &job_queue).await;

    Ok(AppContext {
        config,
        db,
        http,
        user_store,
        job_queue,
    })
}

async fn event_handler(
    ctx: &serenity::Context,
    event: &serenity::FullEvent,
    data: &AppContext,
) -> Result<(), anyhow::Error> {
    if let serenity::FullEvent::InteractionCreate {
        interaction: serenity::Interaction::Component(component),
    } = event
    {
        let custom_id = &component.data.custom_id;
        let (id_type, _id) = discord::helpers::parse_custom_id(custom_id);

        match id_type.parse::<InteractionType>() {
            Ok(InteractionType::Debug) => {
                commands::debug::handle_debug_button(ctx, component).await?
            }
            Ok(InteractionType::Roulette) => {
                roulette::command::handle_roulette_join(ctx, component, data).await?
            }
            Ok(InteractionType::Sardines) => {
                sardines::command::handle_sardines_join(ctx, component, data).await?
            }
            Err(_) => {
                error!(id_type, "Unknown component interaction type");
            }
        }
    }
    Ok(())
}
