import type { Command, CommandInteraction } from './types'

import roll from './interactions/roll'
import bgr from './interactions/bgr'
import guess from './interactions/guess'
import lottery from '../lottery/command'

export const commands: Record<string, Command<CommandInteraction> | undefined> = {
  roll,
  bgr,
  guess,
  lottery,
}
