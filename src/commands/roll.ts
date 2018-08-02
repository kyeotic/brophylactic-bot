import { Message } from 'discord.js'
import R from 'ramda'
import { CommandModule } from 'yargs'

export default function rollCommand(): CommandModule {
  return {
    command: 'roll [dice]',
    describe: 'Roll dice',
    builder: yargs =>
      yargs
        .positional('dice', {
          describe: 'dice to roll e.g. 1d6, d20, 3d6',
          default: '1d6'
        })
        .option('verbose', {
          alias: 'v',
          desc: 'See all dice rolls individually',
          default: false,
          boolean: true,
          demandOption: false
        }),
    handler: argv => {
      argv.promisedResult = handler(argv)
    }
  }
}

export async function handler({
  message,
  dice: command,
  verbose
}: {
  message: Message
  dice: string
  verbose: boolean
}) {
  // Init
  const { channel, member } = message

  command = R.trim(command)
  try {
    let rollResult = roll(command)
    let output = verbose
      ? `${R.sum(rollResult)} with ${rollResult.join(', ')}`
      : R.sum(rollResult)
    channel.send(`${member.displayName} rolled ${command} and got ${output}`)
  } catch (e) {
    console.log(e)
  }
}

function roll(dice: string): number[] {
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

function parseDice(dice: string) {
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
