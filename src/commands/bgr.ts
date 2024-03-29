import { ApplicationCommandOptionType } from '../discord/types'
import { formatDate } from '../util/dates'
import { asGuildMember, bgrLabel, message } from '../discord/api'

import type { AppContext } from '../di'
import type {
  SlashCommand,
  CommandResponse,
  SlashCommandOptions,
  SlashSubCommandOptions,
  CommandInteractionBoolean,
  CommandInteractionUser,
  CommandInteractionInteger,
  DiscordGuildMemberWithUser,
} from '../discord/types'

type BgrInteraction = BgrViewInteraction | BgrSendInteraction
type BgrViewInteraction = SlashCommandOptions<[SlashSubCommandOptions<[CommandInteractionBoolean]>]>
type BgrSendInteraction = SlashCommandOptions<
  [SlashSubCommandOptions<[CommandInteractionUser, CommandInteractionInteger]>]
>

const command: SlashCommand<BgrInteraction> = {
  id: 'bgr',
  // global: true,
  guild: true,
  description: 'Brophylactic Gaming Reputation (℞), the server currency',
  options: [
    {
      name: 'view',
      required: false,
      type: ApplicationCommandOptionType.Subcommand,
      description: 'view ℞',
      options: [
        {
          name: 'public',
          required: false,
          type: ApplicationCommandOptionType.Boolean,
          description:
            'If true response is visible to everyone; otherwise response is private (default: false)',
        },
      ],
    },
    {
      name: 'send',
      required: false,
      type: ApplicationCommandOptionType.Subcommand,
      description: 'Send ℞ to a user',
      options: [
        {
          name: 'to',
          required: true,
          type: ApplicationCommandOptionType.User,
          description: 'User to send to',
        },
        {
          name: 'amount',
          required: true,
          type: ApplicationCommandOptionType.Integer,
          description: 'amount to send (must be positive integer)',
        },
      ],
    },
  ],
  handleSlashCommand: async function (payload: BgrInteraction, context: AppContext) {
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

async function viewBgr(payload: BgrViewInteraction, context: AppContext): Promise<CommandResponse> {
  if (!payload.member?.user.id) {
    return message('missing member user id')
  }
  if (!payload.guild_id) {
    return message('missing payload guild id')
  }

  const isPublic = payload.data?.options?.[0]?.options?.[0]?.value ?? false

  const member = asGuildMember(payload.guild_id, payload.member as DiscordGuildMemberWithUser)

  const bgr = await context.userStore.getUserRep(member)

  const joined = member.joinedAt
    ? formatDate(new Date(member.joinedAt), 'yyyy-MM-dd')
    : '<join date missing>'

  return message(`${member.username} joined on ${joined} has ${bgrLabel(bgr)} `, {
    isPrivate: !isPublic,
  })
}

async function sendBgr(payload: BgrSendInteraction, context: AppContext): Promise<CommandResponse> {
  const { discord } = context
  // This should be impossible, since the entry verifies it
  // But that code might get moved someday
  if (!payload.data?.options?.length || !payload.guild_id)
    return message('sub-command check failed')

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

  const member = asGuildMember(payload.guild_id, payload.member as DiscordGuildMemberWithUser)
  const receiver = await discord.getGuildMember(
    BigInt(payload.guild_id as string),
    BigInt(receiverId as string)
  )

  const senderName = member.username
  const receiverName = receiver.username

  context.userStore
    .incrementUserReps({ member, offset: amount * -1 }, { member: receiver, offset: amount })
    .then(async () => {
      const senderRep = await context.userStore.getUserRep(member)
      const receiverRep = await context.userStore.getUserRep(receiver)

      await discord.updateInteraction({
        applicationId: payload.application_id,
        token: payload.token,
        body: message(
          `${senderName} sent ${receiverName} ${bgrLabel(amount)}.\n${senderName}: ${bgrLabel(
            senderRep
          )}\t${receiverName}: ${bgrLabel(receiverRep)}`
        ),
      })
    })
    .catch(async (e) => {
      // eslint-disable-next-line no-console
      console.error('error updating rep', e)
      await discord.updateInteraction({
        applicationId: payload.application_id,
        token: payload.token,
        body: message(`Error: ${e.message}`),
      })
    })

  //updateInteraction
  return message(`${member.username} is sending ${receiverName} ${bgrLabel(amount)}`)
}
