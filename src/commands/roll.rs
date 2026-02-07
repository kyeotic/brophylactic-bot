use crate::context::Context;
use crate::games::dice;

/// Roll dice
#[poise::command(slash_command, guild_only)]
pub async fn roll(
    ctx: Context<'_>,
    #[description = "dice to roll e.g. 1d6, d20, 3d6"] dice: Option<String>,
    #[description = "See all dice rolls individually"] verbose: Option<bool>,
    #[description = "See response as a private message (default: false)"] private: Option<bool>,
) -> Result<(), anyhow::Error> {
    let dice_input = dice.as_deref().unwrap_or("1d6");
    let verbose = verbose.unwrap_or(false);
    let ephemeral = private.unwrap_or(false);
    let username = &ctx.author().name;

    match dice::roll(dice_input) {
        Ok(results) => {
            let total: u32 = results.iter().sum();
            let msg = if verbose {
                let rolls: Vec<String> = results.iter().map(|r| r.to_string()).collect();
                format!(
                    "{} rolled {} and got {} with {}",
                    username,
                    dice_input,
                    total,
                    rolls.join(", ")
                )
            } else {
                format!("{} rolled {} and got {}", username, dice_input, total)
            };
            ctx.send(poise::CreateReply::default().content(msg).ephemeral(ephemeral))
                .await?;
        }
        Err(e) => {
            ctx.send(
                poise::CreateReply::default()
                    .content(format!("Error rolling: {}", e))
                    .ephemeral(true),
            )
            .await?;
        }
    }

    Ok(())
}
