import { startBot, BigInteraction, Interaction } from 'discordeno'

import { main } from './discord/main'
import { initContext } from './di'
import { botRespond } from './discord/api'
import config from './config'

startBot({
  token: config.discord.botToken,
  intents: config.discord.botIntents,
  eventHandlers: {
    ready() {
      console.log('Successfully connected to gateway')
    },
    interactionCreate(input: BigInteraction) {
      const interaction = bigToSmall(input)
      main(interaction, initContext())
        .then((body) => botRespond(interaction.id, interaction.token, body))
        .catch((error) => console.error('bot error', error))
    },
  },
})

function bigToSmall(interaction: BigInteraction): Interaction {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return {
    ...interaction,
    type: interaction.type,
    id: toSm(interaction.id),
    applicationId: toSm(interaction.applicationId),
    guildId: toSmOpt(interaction.guildId),
    channelId: toSmOpt(interaction.channelId),
    member: interaction.member
      ? {
          ...interaction.member,
          roles: interaction.member?.roles.map(toSm) ?? [],
          user: {
            ...interaction.member.user,
            id: toSm(interaction.member?.user.id),
          },
        }
      : undefined,
    message: interaction.message ? interaction.message.toJSON() : undefined,
  }
}

function toSmOpt(num: bigint | undefined): string | undefined {
  return num?.toString()
}

function toSm(num: bigint): string {
  return num.toString()
}
