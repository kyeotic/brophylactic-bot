import random from 'random'
import seedrandom from 'seedrandom'

import config from '../config'

const baseSeedKey = config.discord.botToken

const baseSeed = random.clone(seedrandom(baseSeedKey))

export function randomInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function seededRandomInclusive(seed: string, min: number, max: number): number {
  const rng = baseSeed.clone(seedrandom(seed + baseSeedKey))
  return rng.int(min, max)
}
