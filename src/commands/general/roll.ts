import { Command } from '../mod.ts'
import roll from '../../util/dice.ts'
import { DiscordApplicationCommandOptionTypes } from '../../deps.ts'

const command: Command = {
  global: true,
  guild: true,
  options: [
    {
      required: false,
      name: 'roll',
      description: 'dice to roll e.g. 1d6, d20, 3d6',
      type: DiscordApplicationCommandOptionTypes.String,
    },
    {
      required: false,
      name: 'verbose',
      description: 'See all dice rolls individually',
      type: DiscordApplicationCommandOptionTypes.Boolean,
    },
  ],
  execute: function (payload) {
    const roll = (payload.data?.options?.[0]?.value ?? '1d6') as string
    const verbose = (payload.data?.options?.[1]?.value || 'nothing') as string
    return { content: `got ${roll} and ${verbose}` }
  },
}

export default command
