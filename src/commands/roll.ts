import { Message } from 'discord.js'
import R from 'ramda'
import { CommandModule } from 'yargs'
import roll from '../util/dice'

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
      return argv.promisedResult
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
