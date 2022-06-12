import roll from '../../games/dice'
import { sum } from '../../util/math'
import { ApplicationCommandOptionType } from '../types'
import { message } from '../api'
import type {
  Command,
  SlashCommand,
  CommandInteractionString,
  CommandInteractionBoolean,
} from '../types'

type RollInteraction = SlashCommand<
  [
    CommandInteractionString | undefined,
    CommandInteractionBoolean | undefined,
    CommandInteractionBoolean | undefined
  ]
>

const command: Command<RollInteraction> = {
  // global: true,
  guild: true,
  description: 'Roll dice',
  options: [
    {
      required: false,
      name: 'dice',
      description: 'dice to roll e.g. 1d6, d20, 3d6',
      type: ApplicationCommandOptionType.String,
    },
    {
      required: false,
      name: 'verbose',
      description: 'See all dice rolls individually',
      type: ApplicationCommandOptionType.Boolean,
    },
    {
      required: false,
      name: 'private',
      description: 'See response as a private message (default: false)',
      type: ApplicationCommandOptionType.Boolean,
    },
  ],
  execute: function (payload) {
    return handleRoll(payload as RollInteraction)
  },
}

export default command

function handleRoll(payload: RollInteraction) {
  const rollInput = payload.data.options?.[0]?.value ?? '1d6'
  const verbose = payload.data?.options?.[1]?.value?.toString() === 'true'
  const isPrivate = payload.data?.options?.[2]?.value ?? false
  const rollResult = roll(rollInput)

  return message(
    `${payload.member?.user.username} rolled ${rollInput} and got ${
      verbose ? `${sum(rollResult)} with ${rollResult.join(', ')}` : sum(rollResult).toString()
    }`,
    { isPrivate }
  )
}
