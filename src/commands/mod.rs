pub mod bgr;
pub mod debug;
pub mod guess;
pub mod roll;

use crate::context::AppContext;

pub fn all() -> Vec<poise::Command<AppContext, anyhow::Error>> {
    vec![
        debug::debug(),
        roll::roll(),
        bgr::bgr(),
        guess::guess(),
        crate::roulette::command::roulette(),
        crate::sardines::command::sardines(),
    ]
}
