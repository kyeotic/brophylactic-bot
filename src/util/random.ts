import { startOfDay, seedRandom, murmurHash } from '../deps.ts'
import config from '../config.ts'

const baseSeedKey = config.discord.botToken as string

export function randomInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function seededRandomRange(seed: string, min: number, max: number): number {
  const rng = new seedRandom(getByteHash(seed + baseSeedKey))
  return rng.randRange(min, max)
}

export function daySeededRandomRange(seed: string, min: number, max: number): number {
  const today = new Date()
  seededRandomRange(`${seed}:${startOfDay(today).getTime()}`, min, max)
  return 2
}

export function getByteHash(str: string) {
  return new DataView(murmurHash(str), 0).getInt32(0)
}
