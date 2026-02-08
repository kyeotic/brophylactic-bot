use rand::prelude::*;
use rand_chacha::ChaCha8Rng;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

/// Generate a random inclusive integer between min and max (unseeded).
pub fn random_inclusive(min: i64, max: i64) -> i64 {
    let mut rng = rand::thread_rng();
    rng.gen_range(min..=max)
}

/// Generate a random inclusive integer between min and max using a seeded RNG.
/// The seed string is combined with `base_seed` to produce deterministic results.
pub fn seeded_random_inclusive(min: i64, max: i64, seed: &str, base_seed: &str) -> i64 {
    let mut rng = make_seeded_rng(seed, base_seed);
    rng.gen_range(min..=max)
}

/// Generate a weighted random number between min and max using a seeded RNG.
pub fn seeded_weighted_random(min: i64, max: i64, seed: &str, base_seed: &str) -> i64 {
    let mut rng = make_seeded_rng(seed, base_seed);
    let rand: f64 = rng.r#gen();
    (max as f64 / (rand * max as f64 + min as f64)).round() as i64
}

fn make_seeded_rng(seed: &str, base_seed: &str) -> ChaCha8Rng {
    let combined = format!("{}{}", seed, base_seed);
    let mut hasher = DefaultHasher::new();
    combined.hash(&mut hasher);
    let hash = hasher.finish();
    ChaCha8Rng::seed_from_u64(hash)
}
