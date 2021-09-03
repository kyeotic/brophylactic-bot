import {
  ApplicationCommandOption,
  Interaction,
  InteractionApplicationCommandCallbackData,
  InteractionResponse,
} from '../deps.ts'
import roll from './interactions/roll.ts'
import bgr from './interactions/bgr.ts'
import guess from './interactions/guess.ts'
import lottery from './interactions/lottery.ts'
import { PermissionLevels } from './interactions/permissionLevels.ts'
import type { AppContext } from '../context.ts'

export const commands: Record<string, Command | undefined> = {
  roll,
  bgr,
  guess,
  lottery,
}

export type CommandResponse =
  | InteractionResponse
  | InteractionApplicationCommandCallbackData
  | Promise<InteractionResponse | InteractionApplicationCommandCallbackData>

export interface Command {
  /** The permissions levels that are allowed to use this command. */
  permissionLevels?:
    | ((payload: Interaction, command: Command) => boolean | Promise<boolean>)
    | (keyof typeof PermissionLevels)[]
  /** The description of the command. Can be a i18n key if you use advanced version. */
  description?: string
  /** Whether or not this slash command should be enabled right now. Defaults to true. */
  enabled?: boolean
  /** Whether this slash command should be created per guild. Defaults to true. */
  guild?: boolean
  /** Whether this slash command should be created once globally and allowed in DMs. Defaults to false. */
  global?: boolean
  /** Whether or not to use the Advanced mode. Defaults to true. */
  advanced?: boolean
  /** The slash command options for this command. */
  options?: ApplicationCommandOption[]
  /** The function that will be called when the command is executed. */
  execute: (payload: Interaction, context: AppContext) => CommandResponse
  canHandleInteraction?: (customId: string, context: AppContext) => Promise<boolean>
}

export function isInteractionResponse(
  response: InteractionResponse | InteractionApplicationCommandCallbackData
): response is InteractionResponse {
  return Reflect.has(response, 'type')
}
