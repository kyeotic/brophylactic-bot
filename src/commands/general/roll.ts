import { Command } from '../mod.ts'
import roll from '../../util/dice.ts'
import {
  DiscordApplicationCommandOptionTypes,
  SlashCommandInteraction,
  ApplicationCommandInteractionDataOptionWithValue,
} from '../../deps.ts'

const command: Command = {
  // global: true,
  guild: true,
  advanced: false,
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
    payload = payload as SlashCommandInteraction
    const roll = ((payload.data?.options?.[0] as ApplicationCommandInteractionDataOptionWithValue)
      ?.value ?? '1d6') as string
    const verbose = ((payload.data
      ?.options?.[1] as ApplicationCommandInteractionDataOptionWithValue)?.value ||
      'nothing') as string
    return { content: `got ${roll} and ${verbose}` }
  },
}

export default command
