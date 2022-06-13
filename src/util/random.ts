import seedRandom from 'seed-random'
import config from '../config.js'

const baseSeedKey = config.discord.botToken as string

export function randomInclusive(min: number, max: number, seed?: string): number {
  const rng = seed ? Math.random : seedRandom(seed + baseSeedKey)
  return Math.floor(rng() * (max - min + 1)) + min
}
