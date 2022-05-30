// import times from 'lodash.times'
// import sum from 'lodash.sum'
import { times, sum } from '../deps.ts'

export default function roll(dice: string): number[] {
  const results: number[] = []

  if (!dice) {
    throw new Error('Missing dice parameter.')
  }

  const { rollCount, modifier, dieSize } = parseDice(dice)

  if (dieSize === 0) throw new Error('Die Size cannot be 0')
  if (Number.isNaN(dieSize)) return []

  results.push(...times(rollCount, (): number => Math.floor(Math.random() * dieSize + 1)))

  if (modifier !== 0) {
    results.push(modifier)
  }
  return results
}

export function parseDice(dice: string) {
  const result: { rollCount: number; dieSize: number; modifier: number } = {
    rollCount: 1,
    modifier: 0,
    dieSize: 0,
  }

  const match = dice.match(/^\s*(\d+)?\s*d\s*(\d+)\s*(.*?)\s*$/)
  if (!match) {
    result.dieSize = parseFloat(dice)
    return result
  }

  if (match[1]) {
    result.rollCount = parseFloat(match[1])
  }
  if (match[2]) {
    result.dieSize = parseFloat(match[2])
  }
  if (match[3]) {
    result.modifier = sum(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      match[3].match(/([+-]\s*\d+)/g)!.map((m) => parseFloat(m.replace(/\s/g, '')))
    )
  }

  return result
}
