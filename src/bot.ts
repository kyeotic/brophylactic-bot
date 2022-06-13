/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  createBot,
  startBot,
  Bot,
  Interaction as DenoInteraction,
  GatewayIntents,
} from 'discordeno'

import { main } from './discord/main.js'
import { initContext } from './di.js'
import { botRespond } from './discord/api.js'
import type { Interaction } from './discord/types.js'
import config from './config.js'

const bot = createBot({
  token: config.discord.botToken,
  intents: config.discord.botIntents.reduce((flags, i) => flags | GatewayIntents[i], 0),
  events: {
    ready() {
      console.log('Successfully connected to gateway')
    },
    interactionCreate(bot: Bot, input: DenoInteraction) {
      const interaction = input as unknown as Interaction
      console.log('received interaction', JSON.stringify(interaction, null, 2))
      main(interaction, initContext())
        .then((body) => botRespond(interaction.id, interaction.token, body))
        .catch((error) => console.error('bot error', error))
    },
  },
  transformers: {
    interaction: (bot, payload) => payload as unknown as DenoInteraction,
  },
})

async function app() {
  await startBot(bot)
}

app().then((e) => console.error(e))
