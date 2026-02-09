use chrono::Utc;

use crate::context::Context;
use crate::discord::helpers::rep_label;
use crate::discord::types::GuildMember;
use crate::util::dates::{format_distance_to_now, get_day_string, is_today};
use crate::util::random::seeded_random_inclusive;

const MAGIC_NUMBER_REWARD: i64 = 1000;
const MAGIC_NUMBER_RANGE: i64 = 3;
const RANGE_REWARD: i64 = 30;
const LAST_DIGIT_REWARD: i64 = 10;
const PAIRWISE_REWARD: i64 = 250;

struct Rule {
    predicate: fn(i64, i64) -> bool,
    reward: i64,
    message: fn(i64, i64) -> String,
}

const RULES: &[Rule] = &[
    Rule {
        predicate: |answer, guess| answer == guess,
        reward: MAGIC_NUMBER_REWARD,
        message: |answer, _guess| {
            let reward = rep_label(MAGIC_NUMBER_REWARD, false);
            format!("# Winner 🚀\n\n**{answer}** is the right number! You won {reward}",)
        },
    },
    Rule {
        predicate: |answer, guess| is_magic_pair(answer, guess),
        reward: PAIRWISE_REWARD,
        message: |answer, guess| {
            let reward = rep_label(PAIRWISE_REWARD, false);
            format!(
                "## Magic Number Match 🪄\n\nYour guess of **{guess}** magically pairs with the correct answer **{answer}**. You won {reward}"
            )
        },
    },
    Rule {
        predicate: |answer, guess| is_within(guess, answer, MAGIC_NUMBER_RANGE),
        reward: RANGE_REWARD,
        message: |answer, guess| {
            let reward = rep_label(RANGE_REWARD, false);
            format!(
                "### Near Correct \n\nYour guess of **{guess}** is within {MAGIC_NUMBER_RANGE} of the correct answer **{answer}**. You won {reward}"
            )
        },
    },
    Rule {
        predicate: |answer, guess| last_digit(answer) == last_digit(guess),
        reward: LAST_DIGIT_REWARD,
        message: |answer, guess| {
            let reward = rep_label(LAST_DIGIT_REWARD, false);
            format!(
                "### Last Digit\n\nYour guess of **{guess}** matches the last digit of the correct answer **{answer}**. You won {reward}"
            )
        },
    },
];

/// Guess your daily 1-100 magic number
#[poise::command(slash_command, guild_only)]
pub async fn guess(
    ctx: Context<'_>,
    #[description = "number to guess"]
    #[min = 1]
    #[max = 100]
    number: i64,
) -> Result<(), anyhow::Error> {
    let data = ctx.data();
    let timezone = data.config.discord.timezone;
    let guild_id = ctx
        .guild_id()
        .ok_or_else(|| anyhow::anyhow!("Not in a guild"))?;

    let member_data = ctx
        .author_member()
        .await
        .ok_or_else(|| anyhow::anyhow!("Could not get member info"))?;
    let member = GuildMember::from_serenity(
        guild_id,
        ctx.author(),
        member_data.joined_at,
        member_data.nick.as_deref(),
    );
    let member_name = &member.username;

    let last_guess = data.user_store.get_user_last_guess(&member).await?;

    if !(1..=100).contains(&number) {
        let last_guess_str = match last_guess {
            Some(dt) => format_distance_to_now(dt),
            None => "never".to_string(),
        };
        let reward_label = rep_label(MAGIC_NUMBER_REWARD, false);
        ctx.send(
            poise::CreateReply::default().content(format!(
                "Guess a number between 1-100 to win {reward_label}. Only guess allowed per day.\n{member_name} made their last Guess {last_guess_str}"
            )),
        )
        .await?;
        return Ok(());
    }

    if let Some(last) = last_guess
        && is_today(timezone, last)
    {
        ctx.send(
            poise::CreateReply::default()
                .content("You already guessed today")
                .ephemeral(true),
        )
        .await?;
        return Ok(());
    }

    let now = Utc::now();
    data.user_store.set_user_last_guess(&member, now).await?;

    let day = get_day_string(timezone, now);
    let seed = format!("{member_name}:{day}");
    let magic_number = seeded_random_inclusive(1, 100, &seed, &data.config.random_seed);

    let matched_rule = RULES.iter().find(|r| (r.predicate)(magic_number, number));

    match matched_rule {
        Some(rule) => {
            data.user_store
                .increment_user_rep(&member, rule.reward)
                .await?;
            let msg = (rule.message)(magic_number, number);
            ctx.send(poise::CreateReply::default().content(msg)).await?;
        }
        None => {
            ctx.send(poise::CreateReply::default().content(format!(
                "You guessed **{number}** but the correct number was **{magic_number}**"
            )))
            .await?;
        }
    }

    Ok(())
}

fn is_within(num: i64, target: i64, range: i64) -> bool {
    num >= target - range && num <= target + range
}

fn last_digit(num: i64) -> i64 {
    num % 10
}

/// A Magic Pair occurs when the numbers form a Gauss sum,
/// i.e. the magic number and the guess add up to 101.
fn is_magic_pair(a: i64, b: i64) -> bool {
    101 - a == b
}
