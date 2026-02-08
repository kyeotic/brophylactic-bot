use poise::serenity_prelude as serenity;
use tracing::error;

use crate::context::Context;
use crate::discord::helpers::bgr_label;
use crate::discord::types::GuildMember;

/// Server Reputation (\u{211e}), the server currency
#[poise::command(slash_command, guild_only, subcommands("view", "send"))]
pub async fn bgr(_ctx: Context<'_>) -> Result<(), anyhow::Error> {
    Ok(())
}

/// View \u{211e}
#[poise::command(slash_command, guild_only)]
async fn view(
    ctx: Context<'_>,
    #[description = "If true response is visible to everyone (default: false)"] public: Option<
        bool,
    >,
) -> Result<(), anyhow::Error> {
    let is_public = public.unwrap_or(false);
    let guild_id = ctx
        .guild_id()
        .ok_or_else(|| anyhow::anyhow!("Not in a guild"))?;

    let member_data = ctx
        .author_member()
        .await
        .ok_or_else(|| anyhow::anyhow!("Could not get member info"))?;
    let member = GuildMember::from_serenity(guild_id, ctx.author(), member_data.joined_at);

    let rep = ctx.data().user_store.get_user_rep(&member).await?;

    let joined = match member.joined_at {
        Some(dt) => dt.format("%Y-%m-%d").to_string(),
        None => "<join date missing>".to_string(),
    };

    let username = &member.username;
    let rep_label = bgr_label(rep, false);
    let msg = format!("{username} joined on {joined} has {rep_label}");
    ctx.send(
        poise::CreateReply::default()
            .content(msg)
            .ephemeral(!is_public),
    )
    .await?;

    Ok(())
}

/// Send \u{211e} to a user
#[poise::command(slash_command, guild_only)]
async fn send(
    ctx: Context<'_>,
    #[description = "User to send to"] to: serenity::User,
    #[description = "amount to send (must be positive integer)"] amount: i64,
) -> Result<(), anyhow::Error> {
    let guild_id = ctx
        .guild_id()
        .ok_or_else(|| anyhow::anyhow!("Not in a guild"))?;

    if to.id == ctx.author().id {
        ctx.send(
            poise::CreateReply::default()
                .content("Unable to send \u{211e} to yourself")
                .ephemeral(true),
        )
        .await?;
        return Ok(());
    }

    if amount < 1 {
        ctx.send(
            poise::CreateReply::default()
                .content("Can only send \u{211e} in positive integer amounts")
                .ephemeral(true),
        )
        .await?;
        return Ok(());
    }

    let sender_member_data = ctx
        .author_member()
        .await
        .ok_or_else(|| anyhow::anyhow!("Could not get member info"))?;
    let sender = GuildMember::from_serenity(guild_id, ctx.author(), sender_member_data.joined_at);

    let receiver_data = guild_id.member(ctx.serenity_context(), to.id).await?;
    let receiver = GuildMember::from_serenity(guild_id, &to, receiver_data.joined_at);

    let sender_name = sender.username.clone();
    let receiver_name = receiver.username.clone();

    let amount_label = bgr_label(amount, false);
    let initial_msg = format!("{sender_name} is sending {receiver_name} {amount_label}");
    let handle = ctx
        .send(poise::CreateReply::default().content(initial_msg))
        .await?;

    match ctx
        .data()
        .user_store
        .increment_user_reps(&[(sender.clone(), -amount), (receiver.clone(), amount)])
        .await
    {
        Ok(_) => {
            let sender_rep = ctx.data().user_store.get_user_rep(&sender).await?;
            let receiver_rep = ctx.data().user_store.get_user_rep(&receiver).await?;

            let sender_rep_label = bgr_label(sender_rep, false);
            let receiver_rep_label = bgr_label(receiver_rep, false);
            let msg = format!(
                "{sender_name} sent {receiver_name} {amount_label}.\n{sender_name}: {sender_rep_label}\t{receiver_name}: {receiver_rep_label}"
            );
            handle
                .edit(ctx, poise::CreateReply::default().content(msg))
                .await?;
        }
        Err(e) => {
            error!("error updating rep: {e:?}");
            handle
                .edit(
                    ctx,
                    poise::CreateReply::default().content(format!("Error: {e}")),
                )
                .await?;
        }
    }

    Ok(())
}
