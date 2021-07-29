import { Message } from 'discord.js'
import _ from 'lodash'
import { CommandModule } from 'yargs'
import roll from '../util/dice'

export default function rollCommand(): CommandModule {
  return {
    command: 'roll [dice]',
    describe: 'Roll dice',
    builder: (yargs) =>
      yargs
        .positional('dice', {
          describe: 'dice to roll e.g. 1d6, d20, 3d6',
          default: '1d6',
        })
        .option('verbose', {
          alias: 'v',
          desc: 'See all dice rolls individually',
          default: false,
          boolean: true,
          demandOption: false,
        }),
    handler: (argv: any) => {
      argv.promisedResult = handler(argv)
      return argv.promisedResult
    },
  }
}

export async function handler({
  message,
  dice: command,
  verbose,
}: {
  message: Message
  dice: string
  verbose: boolean
}): Promise<void> {
  // Init
  const { channel, member } = message

  if (!member) {
    throw new Error('Guild context missing')
  }

  command = _.trim(command)
  try {
    const rollResult = roll(command)
    const output = verbose
      ? `${_.sum(rollResult)} with ${rollResult.join(', ')}`
      : _.sum(rollResult)
    channel.send(`${member.displayName} rolled ${command} and got ${output}`)
  } catch (e) {
    console.log(e)
  }
}
