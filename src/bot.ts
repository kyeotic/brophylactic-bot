/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  createBot,
  startBot,
  Bot,
  Interaction as DenoInteraction,
  GatewayIntents,
} from 'discordeno'

import config from './config'
import { main } from './discord/main'
import { initContext } from './di'
import type { Interaction } from './discord/types'

const context = initContext()

const bot = createBot({
  token: config.discord.botToken,
  intents: config.discord.botIntents.reduce((flags, i) => flags | GatewayIntents[i], 0),
  events: {
    ready() {
      console.log('Successfully connected to gateway')
    },
    interactionCreate(bot: Bot, input: DenoInteraction) {
      const interaction = input as unknown as Interaction
      // console.log('received interaction', JSON.stringify(interaction, null, 2))
      main(interaction, context)
        .then((body) => context.discord.botRespond(interaction.id, interaction.token, body))
        .catch((error) => console.error('bot error', error))
    },
  },
  transformers: {
    interaction: (bot, payload) => payload as unknown as DenoInteraction,
  },
})

async function app() {
  context.jobQueue.start()
  await startBot(bot)
}

app().then((e) => console.error(e))
