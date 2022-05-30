import { Command } from './types.ts'

import roll from './interactions/roll.ts'
import bgr from './interactions/bgr.ts'
import guess from './interactions/guess.ts'
import lottery from '../lottery/command.ts'

export const commands: Record<string, Command | undefined> = {
  roll,
  bgr,
  guess,
  lottery,
}
