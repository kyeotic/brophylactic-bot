use crate::context::AppContext;

pub fn all() -> Vec<poise::Command<AppContext, anyhow::Error>> {
    vec![
        crate::discord::debug::debug(),
        crate::games::roll::roll(),
        crate::users::bgr::bgr(),
        crate::games::guess::guess(),
        crate::roulette::command::roulette(),
        crate::sardines::command::sardines(),
    ]
}
