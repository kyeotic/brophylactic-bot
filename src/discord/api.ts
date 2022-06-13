import config from '../config'
import urlJoin from 'url-join'
import request from 'request-micro'
import { InteractionResponseType } from './types'
import type {
  GuildMember,
  DiscordGuildMemberWithUser,
  InteractionResponse,
  CommandResponse,
  MessageResponse,
} from './types'

const defaultHeaders = {
  'Content-Type': 'application/json',
  'User-Agent': config.discord.userAgent,
}

export async function botRespond(
  interactionId: string | bigint,
  token: string,
  body: any
): Promise<void> {
  await request({
    url: urlJoin(
      config.discord.apiHost,
      'interactions',
      interactionId.toString(),
      token,
      'callback'
    ),
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify(body),
  })
}

export async function ackDeferred({
  token,
  interactionId,
}: {
  token: string
  interactionId: string
}): Promise<void> {
  await request({
    url: urlJoin(config.discord.apiHost, 'interactions', interactionId, token, 'callback'),
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({
      type: InteractionResponseType.DeferredChannelMessageWithSource,
    }),
  })
}

export async function updateInteraction({
  applicationId,
  token,
  body,
  messageId = '@original',
}: {
  applicationId: string
  token: string
  body: any
  messageId?: string
}) {
  await request({
    url: urlJoin(config.discord.apiHost, 'webhooks', applicationId, token, 'messages', messageId),
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  // console.log('discord', res.status, await res.text())
}

export async function deployCommand({
  applicationId,
  guildId,
  command,
  botToken,
}: {
  applicationId: string
  guildId?: string
  command: any
  botToken: string
}): Promise<void> {
  await request({
    url: guildId
      ? urlJoin(
          config.discord.apiHost,
          'applications',
          applicationId,
          'guilds',
          guildId,
          'commands'
        )
      : urlJoin(config.discord.apiHost, 'applications', applicationId, 'commands'),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
    },
    body: JSON.stringify(command),
  })
}

export async function getCommands({
  applicationId,
  guildId,
  botToken,
}: {
  applicationId: string
  guildId?: string
  botToken: string
}): Promise<any> {
  await request({
    url: guildId
      ? urlJoin(
          config.discord.apiHost,
          'applications',
          applicationId,
          'guilds',
          guildId,
          'commands'
        )
      : urlJoin(config.discord.apiHost, 'applications', applicationId, 'commands'),
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
    },
  })
}

export async function getGuildMember(
  guildId: string | bigint,
  userId: string | bigint
): Promise<GuildMember> {
  const res = await request({
    url: urlJoin(
      config.discord.apiHost,
      'guilds',
      guildId.toString(),
      'members',
      userId.toString()
    ),
    headers: defaultHeaders,
    json: true,
  })

  return asGuildMember(guildId.toString(), res.data as DiscordGuildMemberWithUser)
}

export function asGuildMember(guildId: string, member: DiscordGuildMemberWithUser): GuildMember {
  return {
    id: member.user.id,
    guildId: guildId,
    username: member?.nick ?? member.user?.username,
    joinedAt: member.joined_at,
  }
}

export function ackButton() {
  return {
    type: InteractionResponseType.DeferredMessageUpdate,
  }
}

const nonMessageTypes: readonly InteractionResponseType[] = [
  InteractionResponseType.Pong,
  InteractionResponseType.ApplicationCommandAutocompleteResult,
  InteractionResponseType.Modal,
] as const

export function message(
  content?: string,
  {
    isPrivate = false,
    type = InteractionResponseType.ChannelMessageWithSource,
  }: { isPrivate?: boolean; type?: InteractionResponseType } = {}
): MessageResponse {
  if (nonMessageTypes.includes(type)) {
    throw new Error('Invalid interactiont type for message response')
  }
  return {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    type,
    data: {
      content,
      flags: isPrivate ? 64 : undefined,
    },
  }
}

export function privateMessage(content: string): MessageResponse {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content,
      flags: 64, // private
    },
  }
}

/** encode the type and id into customId for use in message components*/
export function encodeCustomId(type: string, id: string): string {
  return `${type}:${id}`
}

/**
 * extract the type and id from an encoded customId
 * @param {string} customId encoded customId
 * @return {*} {[string, string]} returns [type: string, id: string]
 */
export function parseCustomId(customId: string): [string, string] {
  const [type, id] = customId.split(':')
  return [type, id]
}
