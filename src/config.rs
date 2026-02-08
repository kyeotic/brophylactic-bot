use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    #[allow(dead_code)] // used by HTTP gateway (http is not implemented yet)
    pub port: u16,
    pub stage: String,
    pub discord: DiscordConfig,
    pub firebase: FirebaseConfig,
}

#[derive(Debug, Clone)]
pub struct DiscordConfig {
    pub timezone: String,
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
        let stage = env::var("stage").unwrap_or_else(|_| "dev".to_string());

        let bot_token = required_env("BOT_TOKEN")?;
        let public_key = required_env("DISCORD_PUBLIC_KEY")?;
        let server_id = required_env("DISCORD_SERVER_ID")?;
        let firebase_64 = required_env("FIREBASE_64")?;

        Ok(Config {
            port: 8006,
            stage,
            discord: DiscordConfig {
                timezone: "America/Los_Angeles".to_string(),
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
    env::var(name).map_err(|_| anyhow::anyhow!("ENV VAR {} is required", name))
}
