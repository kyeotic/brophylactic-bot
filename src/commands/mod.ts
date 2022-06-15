import type { BaseCommand, SlashCommand, MessageComponentCommand } from '../discord/types'

import roll from './roll'
import bgr from './bgr'
import guess from './guess'
import roulette from '../roulette/command'

const commands: BaseCommand[] = [roll, bgr, guess, roulette]

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
