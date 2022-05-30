import {
  Command,
  SlashCommand,
  SlashSubCommand,
  ApplicationCommandInteractionDataOptionBoolean,
  ApplicationCommandInteractionDataOptionUser,
  ApplicationCommandInteractionDataOptionInteger,
} from '../types.ts'
import {
  DiscordApplicationCommandOptionTypes,
  SlashCommandInteraction,
  GuildMemberWithUser,
  InteractionResponse,
  InteractionApplicationCommandCallbackData,
} from '../../deps.ts'
import { formatDate } from '../../deps.ts'
import { updateInteraction, getGuildMember, asGuildMember, message } from '../api.ts'
import type { AppContext } from '../../di.ts'

type BgrViewInteraction = SlashCommand<
  [SlashSubCommand<[ApplicationCommandInteractionDataOptionBoolean]>]
>
type BgrSendInteraction = SlashCommand<
  [
    SlashSubCommand<
      [ApplicationCommandInteractionDataOptionUser, ApplicationCommandInteractionDataOptionInteger]
    >
  ]
>

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
      options: [
        {
          name: 'public',
          required: false,
          type: DiscordApplicationCommandOptionTypes.Boolean,
          description:
            'If true response is visible to everyone; otherwise response is private (default: false)',
        },
      ],
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

    // console.log('bgr payload', payload.data?.options)
    // console.log('bgr payload options', payload.data?.options)

    if (!payload.data?.options?.length) return message('missing required sub-command')
    const type = payload.data?.options[0].name

    switch (type) {
      case 'view':
        return viewBgr(payload as BgrViewInteraction, context)
      case 'send':
        return sendBgr(payload as BgrSendInteraction, context)
    }

    return message(`BGR subcommand not found: ${type}`)
  },
}

export default command

async function viewBgr(
  payload: BgrViewInteraction,
  context: AppContext
): Promise<InteractionResponse | InteractionApplicationCommandCallbackData> {
  if (!payload.member?.user.id) {
    return message('missing member user id')
  }
  if (!payload.guildId) {
    return message('missing payload guild id')
  }

  const isPublic = payload.data?.options?.[0]?.options?.[0]?.value ?? false

  const member = asGuildMember(payload.guildId, payload.member as GuildMemberWithUser)

  const bgr = await context.userStore.getUserRep(member)

  const joined = member.joinedAt
    ? // @ts-ignore: bad compilation on argument arity
      formatDate(new Date(member.joinedAt), 'yyyy-MM-dd')
    : '<join date missing>'

  return message(`${member.username} joined on ${joined} has ℞${bgr}`, { isPrivate: !isPublic })
}

async function sendBgr(
  payload: BgrSendInteraction,
  context: AppContext
): Promise<InteractionResponse | InteractionApplicationCommandCallbackData> {
  // This should be impossible, since the entry verifies it
  // But that code might get moved someday
  if (!payload.data?.options?.length || !payload.guildId) return message('sub-command check failed')

  const input = payload.data!.options[0]

  if (input.options?.length !== 2) return message('sub-command input validation failed')

  const receiverId = input.options[0].value
  const amount = input.options[1].value as number

  if (receiverId.toString() === payload.member?.user.id.toString()) {
    return message(`Unable to send ℞ to yourself`)
  }

  if (!Number.isInteger(amount) || amount < 1) {
    return message('Can only send ℞ in positive integer amounts')
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
        body: message(
          `${senderName} sent ${receiverName} ℞${amount}.\n${senderName}: ℞${senderRep}\t${receiverName}: ℞${receiverRep}`
        ),
      })
    })
    .catch(async (e) => {
      console.error('error updating rep', e)
      await updateInteraction({
        applicationId: payload.applicationId,
        token: payload.token,
        body: message(`Error: ${e.message}`),
      })
    })

  //updateInteraction
  return message(`${member.username} is sending ${receiverName} ℞${amount}`)
}
