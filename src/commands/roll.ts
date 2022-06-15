import roll from '../games/dice'
import { sum } from '../util/math'
import { ApplicationCommandOptionType } from '../discord/types'
import { message } from '../discord/api'
import type {
  SlashCommand,
  SlashCommandOptions,
  CommandResponse,
  CommandInteractionString,
  CommandInteractionBoolean,
} from '../discord/types'

type RollInteraction = SlashCommandOptions<
  [
    CommandInteractionString | undefined,
    CommandInteractionBoolean | undefined,
    CommandInteractionBoolean | undefined
  ]
>

const command: SlashCommand<RollInteraction> = {
  id: 'roll',
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
  handleSlashCommand: async function (payload): Promise<CommandResponse> {
    return handleRoll(payload as RollInteraction)
  },
}

export default command

function handleRoll(payload: RollInteraction): CommandResponse {
  const rollInput = payload.data.options?.[0]?.value ?? '1d6'
  const verbose = payload.data?.options?.[1]?.value?.toString() === 'true'
  const isPrivate = payload.data?.options?.[2]?.value ?? false

  try {
    const rollResult = roll(rollInput)
    return message(
      `${payload.member?.user.username} rolled ${rollInput} and got ${
        verbose ? `${sum(rollResult)} with ${rollResult.join(', ')}` : sum(rollResult).toString()
      }`,
      { isPrivate }
    )
  } catch (e: unknown) {
    const error = (e as Error).message ? (e as Error).message : (e as any).toString()
    return message(`Error rolling: ${error}`, { isPrivate: true })
  }
}
