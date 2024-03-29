import type { BaseCommand, SlashCommand, MessageComponentCommand } from '../discord/types'

import roll from './roll'
import bgr from './bgr'
import guess from './guess'
import debug from './debug'
import roulette from '../roulette/command'
import sardines from '../sardines/command'

const commands: BaseCommand[] = [debug, roll, bgr, guess, roulette, sardines]

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
