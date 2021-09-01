import { startBot, Interaction } from './deps.ts'
import config from './config.ts'
import { initContext } from './context.ts'
import { botRespond } from './discord/api.ts'

import { main } from './discord/main.ts'

startBot({
  token: config.discord.botToken,
  intents: config.discord.botIntents,
  eventHandlers: {
    ready() {
      console.log('Successfully connected to gateway')
    },
    interactionCreate(interaction: Interaction) {
      main(interaction, initContext())
        .then((body) => botRespond(interaction.id, interaction.token, body))
        .catch((error) => console.error('bot error', error))
    },
  },
})
