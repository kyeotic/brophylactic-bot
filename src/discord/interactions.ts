import type { Command, CommandInteraction } from './types.js'

import roll from './interactions/roll.js'
import bgr from './interactions/bgr.js'
import guess from './interactions/guess.js'
import lottery from '../lottery/command.js'

export const commands: Record<string, Command<CommandInteraction> | undefined> = {
  roll,
  bgr,
  guess,
  lottery,
}
