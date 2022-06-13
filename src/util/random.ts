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
