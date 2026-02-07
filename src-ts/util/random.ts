import { create } from 'random-seed'
import config from '../config'

const baseSeedKey = config.discord.botToken as string

export function randomInclusive(min: number, max: number, seed?: string): number {
  if (!seed) {
    // make random inclusive
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  return create(seed + baseSeedKey).intBetween(min, max)
}

/*

Taken from https://stackoverflow.com/a/46774731
After a 100 iterations you should see roughly
    ==================
    | Result | Times |
    ==================
    |      1 |    55 |
    |      2 |    28 |
    |      3 |     8 |
    |      4 |     7 |
    |      5 |     2 |
    ==================

    note: 49 + weightedRandom(1, 51) if you want to get numbers between 50 and 100
*/
export function weightedRandom(min: number, max: number, seed?: string): number {
  const rand = seed ? create(seed + baseSeedKey).random() : Math.random()
  return Math.round(max / (rand * max + min))
}
