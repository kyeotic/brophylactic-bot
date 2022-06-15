import { times } from '../util/func'

interface DiceRoll {
  count: number
  size: number
}

export default function roll(dice: string): number[] {
  const results: number[] = []

  if (!dice) {
    throw new Error('Missing dice parameter.')
  }

  const { count, size } = parseDice(dice)

  if (size === 0) throw new Error('Die Size cannot be 0')
  if (Number.isNaN(size)) return []

  results.push(...times(count, (): number => Math.floor(Math.random() * size + 1)))

  return results
}

export function parseDice(dice: string): DiceRoll {
  const result: DiceRoll = {
    count: 1,
    size: 6,
  }

  const match = dice.match(/^(\d+)d(\d+)$/)
  if (!match) {
    throw new Error(
      'Dice must in the format "NdX" where N is a number of dice to roll and X is their size. e.g. 2d100'
    )
  }

  const [, count, size] = match
  result.count = asInt(count)
  result.size = asInt(size)

  return result
}

function asInt(val: string): number {
  return Math.floor(parseFloat(val))
}
