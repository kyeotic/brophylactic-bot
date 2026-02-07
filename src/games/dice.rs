use rand::Rng;
use regex::Regex;
use std::sync::LazyLock;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DiceError {
    #[error("Missing dice parameter.")]
    MissingInput,
    #[error(
        "Dice must be in the format \"NdX\" where N is a number of dice to roll and X is their size. e.g. 2d100"
    )]
    InvalidFormat,
    #[error("Die size cannot be 0")]
    ZeroSize,
}

#[derive(Debug, Clone)]
pub struct DiceRoll {
    pub count: u32,
    pub size: u32,
}

static DICE_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d+)d(\d+)$").unwrap());

/// Parse a dice notation string like "3d6" into a DiceRoll.
pub fn parse_dice(dice: &str) -> Result<DiceRoll, DiceError> {
    let caps = DICE_RE.captures(dice).ok_or(DiceError::InvalidFormat)?;

    let count: u32 = caps[1].parse().map_err(|_| DiceError::InvalidFormat)?;
    let size: u32 = caps[2].parse().map_err(|_| DiceError::InvalidFormat)?;

    if size == 0 {
        return Err(DiceError::ZeroSize);
    }

    Ok(DiceRoll { count, size })
}

/// Roll dice from a notation string like "3d6". Returns individual roll results.
pub fn roll(dice: &str) -> Result<Vec<u32>, DiceError> {
    if dice.is_empty() {
        return Err(DiceError::MissingInput);
    }

    let parsed = parse_dice(dice)?;
    let mut rng = rand::thread_rng();

    let results: Vec<u32> = (0..parsed.count)
        .map(|_| rng.gen_range(1..=parsed.size))
        .collect();

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_dice() {
        let d = parse_dice("3d6").unwrap();
        assert_eq!(d.count, 3);
        assert_eq!(d.size, 6);
    }

    #[test]
    fn parse_single_die() {
        let d = parse_dice("1d20").unwrap();
        assert_eq!(d.count, 1);
        assert_eq!(d.size, 20);
    }

    #[test]
    fn parse_invalid_format() {
        assert!(parse_dice("abc").is_err());
        assert!(parse_dice("d6").is_err());
        assert!(parse_dice("3d").is_err());
    }

    #[test]
    fn parse_zero_size() {
        assert!(matches!(parse_dice("1d0"), Err(DiceError::ZeroSize)));
    }

    #[test]
    fn roll_produces_correct_count() {
        let results = roll("4d6").unwrap();
        assert_eq!(results.len(), 4);
        for r in &results {
            assert!(*r >= 1 && *r <= 6);
        }
    }

    #[test]
    fn roll_empty_input() {
        assert!(matches!(roll(""), Err(DiceError::MissingInput)));
    }
}
