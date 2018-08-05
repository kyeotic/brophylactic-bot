import R from 'ramda'

export default function roll(dice: string): number[] {
  let results: number[] = []

  if (!dice) {
    throw new Error('Missing dice parameter.')
  }

  let { rollCount, modifier, dieSize } = parseDice(dice)

  if (dieSize === 0) throw new Error('Die Size cannot be 0')
  if (Number.isNaN(dieSize)) return []

  results.push(
    ...R.times(() => Math.floor(Math.random() * dieSize + 1), rollCount)
  )

  if (modifier !== 0) {
    results.push(modifier)
  }
  return results
}

export function parseDice(dice: string) {
  let result: { rollCount: number; dieSize: number; modifier: number } = {
    rollCount: 1,
    modifier: 0,
    dieSize: 0
  }

  let match = dice.match(/^\s*(\d+)?\s*d\s*(\d+)\s*(.*?)\s*$/)
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
    result.modifier = R.sum(
      match[3].match(/([+-]\s*\d+)/g).map(m => parseFloat(m.replace(/\s/g, '')))
    )
  }

  return result
}
