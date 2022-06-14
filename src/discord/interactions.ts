import type { BaseCommand, SlashCommand, MessageComponentCommand } from './types'

import roll from './interactions/roll'
import bgr from './interactions/bgr'
import guess from './interactions/guess'
import lottery from '../lottery/command'

const commands: BaseCommand[] = [roll, bgr, guess, lottery]

export const slashCommands = new Map<string, SlashCommand<any>>(
  commands
    .filter((c) => (c as SlashCommand<any>).handleSlashCommand)
    .map((c: SlashCommand<any>) => [c.id, c])
)

export const messageCommands = new Map<string, MessageComponentCommand>(
  commands
    .filter((c) => (c as MessageComponentCommand).messageInteractionType)
    .map((c: MessageComponentCommand) => [c.messageInteractionType, c])
)
