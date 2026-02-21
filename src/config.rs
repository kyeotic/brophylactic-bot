use chrono_tz::Tz;
use std::env;
use tracing::info;

#[derive(Debug, Clone)]
pub struct Config {
    #[allow(dead_code)] // used by HTTP gateway (http is not implemented yet)
    pub port: u16,
    pub job_queue_poll_interval_ms: u64,
    pub min_players_before_rejoin: usize,
    pub sardines_expiry_seconds: u64,
    pub random_seed: String,
    pub discord: DiscordConfig,
    pub firebase: FirebaseConfig,
}

#[derive(Debug, Clone)]
pub struct DiscordConfig {
    pub timezone: Tz,
    pub bot_token: String,
    #[allow(dead_code)] // used by HTTP gateway for sig verification (http is not implemented yet)
    pub public_key: String,
    pub server_id: String,
}

#[derive(Debug, Clone)]
pub struct FirebaseConfig {
    pub project_id: String,
    pub cert_base64: String,
}

impl Config {
    pub fn load() -> anyhow::Result<Self> {
        let stage = env::var("STAGE").unwrap_or_else(|_| "prod".to_string());
        info!("Loading config for stage: {stage}");
        let isDev = stage == "local" || stage == "dev";
        let isProd = !isDev;

        let bot_token = required_env("BOT_TOKEN")?;
        let public_key = required_env("DISCORD_PUBLIC_KEY")?;
        let server_id = required_env("DISCORD_SERVER_ID")?;
        let firebase_64 = required_env("FIREBASE_64")?;
        let random_seed =
            env::var("RANDOM_SEED").unwrap_or_else(|_| "discord-bot-default-seed".to_string());

        let min_players_before_rejoin = if isDev { 1 } else { 4 };

        let sardines_expiry_seconds = if isDev {
            300 // 5 minutes for development
        } else {
            86400 // 24 hours for production
        };

        info!(
            "Config loaded: min_players_before_rejoin={}, sardines_expiry_seconds={}",
            min_players_before_rejoin, sardines_expiry_seconds
        );

        Ok(Config {
            port: 8006,
            job_queue_poll_interval_ms: 5000,
            min_players_before_rejoin,
            sardines_expiry_seconds,
            random_seed,
            discord: DiscordConfig {
                timezone: "America/Los_Angeles"
                    .parse::<Tz>()
                    .map_err(|e| anyhow::anyhow!("Invalid timezone: {e}"))?,
                bot_token,
                public_key,
                server_id,
            },
            firebase: FirebaseConfig {
                project_id: "brophylactic-gaming".to_string(),
                cert_base64: firebase_64,
            },
        })
    }
}

fn required_env(name: &str) -> anyhow::Result<String> {
    env::var(name).map_err(|_| anyhow::anyhow!("ENV VAR {name} is required"))
}
