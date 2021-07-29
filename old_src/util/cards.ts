export const ranks = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

export const suits = ['♥️', '♦️', '♣️', '♠️']

export const pokerDeck = ranks.reduce((deck: string[], rank: string) => {
  deck.push(...suits.map((s) => rank + s))
  return deck
}, [])
