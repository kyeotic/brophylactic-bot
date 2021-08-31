import { Command } from './mod.ts'
import roll from '../../games/dice.ts'
import {
  sum,
  DiscordApplicationCommandOptionTypes,
  SlashCommandInteraction,
  ApplicationCommandInteractionDataOptionWithValue,
} from '../../deps.ts'

const command: Command = {
  // global: true,
  guild: true,
  description: 'Roll dice',
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

    const rollInput = ((payload.data
      ?.options?.[0] as ApplicationCommandInteractionDataOptionWithValue)?.value ?? '1d6') as string

    const verbose =
      (((payload.data?.options?.[1] as ApplicationCommandInteractionDataOptionWithValue)?.value ||
        'nothing') as string)
        .toString()
        .toLowerCase() === 'true'

    const rollResult = roll(rollInput)

    return {
      content: `${payload.member?.user.username} rolled ${rollInput} and got ${
        verbose ? `${sum(rollResult)} with ${rollResult.join(', ')}` : sum(rollResult).toString()
      }`,
    }
  },
}

export default command
