#[allow(dead_code)]
pub const RANKS: &[&str] = &[
    "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A",
];

#[allow(dead_code)]
pub const SUITS: &[&str] = &[
    "\u{2665}\u{fe0f}", // ♥️
    "\u{2666}\u{fe0f}", // ♦️
    "\u{2663}\u{fe0f}", // ♣️
    "\u{2660}\u{fe0f}", // ♠️
];

/// Build a full 52-card poker deck (13 ranks x 4 suits).
#[allow(dead_code)]
pub fn poker_deck() -> Vec<String> {
    RANKS
        .iter()
        .flat_map(|rank| SUITS.iter().map(move |suit| format!("{}{}", rank, suit)))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deck_size() {
        assert_eq!(poker_deck().len(), 52);
    }

    #[test]
    fn deck_contains_ace_of_spades() {
        let deck = poker_deck();
        assert!(deck
            .iter()
            .any(|c| c.starts_with("A") && c.contains('\u{2660}')));
    }
}
