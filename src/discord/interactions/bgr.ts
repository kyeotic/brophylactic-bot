import { Command } from './mod.ts'
import {
  formatDate,
  DiscordApplicationCommandOptionTypes,
  SlashCommandInteraction,
  GuildMemberWithUser,
  InteractionResponse,
  InteractionApplicationCommandCallbackData,
  ApplicationCommandInteractionDataOptionSubCommand,
} from '../../deps.ts'
import { updateInteraction, getGuildMember, asGuildMember } from '../api.ts'
import type { AppContext } from '../../context.ts'

const command: Command = {
  // global: true,
  guild: true,
  description: 'Brophylactic Gaming Reputation (℞), the server currency',
  options: [
    {
      name: 'view',
      required: false,
      type: DiscordApplicationCommandOptionTypes.SubCommand,
      description: 'view ℞',
    },
    {
      name: 'send',
      required: false,
      type: DiscordApplicationCommandOptionTypes.SubCommand,
      description: 'Send ℞ to a user',
      options: [
        {
          name: 'to',
          required: true,
          type: DiscordApplicationCommandOptionTypes.User,
          description: 'User to send to',
        },
        {
          name: 'amount',
          required: true,
          type: DiscordApplicationCommandOptionTypes.Integer,
          description: 'amount to send (must be positive integer)',
        },
      ],
    },
  ],
  execute: function (payload, context) {
    payload = payload as SlashCommandInteraction

    // console.log('bgr payload', payload)
    // console.log('bgr payload options', payload.data?.options)

    if (!payload.data?.options?.length) return { content: 'missing required sub-command' }
    const type = payload.data?.options[0].name

    switch (type) {
      case 'view':
        return viewBgr(payload, context)
      case 'send':
        return sendBgr(payload, context)
    }

    return {
      content: `BGR subcommand not found: ${type}`,
    }
  },
}

export default command

async function viewBgr(
  payload: SlashCommandInteraction,
  context: AppContext
): Promise<InteractionResponse | InteractionApplicationCommandCallbackData> {
  if (!payload.member?.user.id) {
    return {
      content: 'missing member user id',
    }
  }
  if (!payload.guildId) {
    return {
      content: 'missing payload guild id',
    }
  }

  const member = asGuildMember(payload.guildId, payload.member as GuildMemberWithUser)

  const bgr = await context.userStore.getUserRep(member)

  const joined = member.joinedAt
    ? formatDate(new Date(member.joinedAt), 'yyyy-MM-dd')
    : '<join date missing>'
  return {
    content: `${member.username} joined on ${joined} has ℞${bgr}`,
  }
}

async function sendBgr(
  payload: SlashCommandInteraction,
  context: AppContext
): Promise<InteractionResponse | InteractionApplicationCommandCallbackData> {
  // This should be impossible, since the entry verifies it
  // But that code might get moved someday
  if (!payload.data?.options?.length || !payload.guildId)
    return { content: 'sub-command check failed' }
  const input = payload.data!.options[0] as ApplicationCommandInteractionDataOptionSubCommand

  if (input.options?.length !== 2) return { content: 'sub-command input validation failed' }

  const receiverId = input.options[0].value
  const amount = input.options[1].value as number

  if (receiverId.toString() === payload.member?.user.id.toString()) {
    return { content: `Unable to send ℞ to yourself` }
  }

  if (!Number.isInteger(amount) || amount < 1) {
    return {
      content: 'Can only send ℞ in positive integer amounts',
    }
  }

  const member = asGuildMember(payload.guildId, payload.member as GuildMemberWithUser)
  const receiver = await getGuildMember(
    BigInt(payload.guildId as string),
    BigInt(receiverId as string)
  )

  const senderName = member.username
  const receiverName = receiver.username

  context.userStore
    .incrementUserReps({ member, offset: amount * -1 }, { member: receiver, offset: amount })
    .then(async () => {
      const senderRep = await context.userStore.getUserRep(member)
      const receiverRep = await context.userStore.getUserRep(receiver)

      await updateInteraction({
        applicationId: payload.applicationId,
        token: payload.token,
        body: {
          content: `${senderName} sent ${receiverName} ℞${amount}.\n${senderName}: ℞${senderRep}\t${receiverName}: ℞${receiverRep}`,
        },
      })
    })
    .catch(async (e) => {
      console.error('error updating rep', e)
      await updateInteraction({
        applicationId: payload.applicationId,
        token: payload.token,
        body: {
          content: `Error: ${e.message}`,
        },
      })
    })

  //updateInteraction
  return {
    content: `${member.username} is sending ${receiverName} ℞${amount}`,
  }
}
