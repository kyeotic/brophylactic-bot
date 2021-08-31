import { startBot, Interaction, DiscordenoMember } from './deps.ts'
import config from './config.ts'
import { initContext } from './context.ts'

import { botMain } from './discord/main.ts'

startBot({
  token: config.discord.botToken,
  intents: config.discord.botIntents,
  eventHandlers: {
    ready() {
      console.log('Successfully connected to gateway')
    },
    interactionCreate(interaction: Interaction, member?: DiscordenoMember) {
      botMain(interaction, initContext()).catch((error) => console.error('bot error', error))
    },
  },
})
