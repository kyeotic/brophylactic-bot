import config from '../config'
import urlJoin from 'url-join'
import camelCase from 'camelcase-keys'
import snakeCase from 'snakecase-keys'
import request from 'request-micro'
import { DiscordInteractionResponseTypes } from './types'
import type { GuildMember, GuildMemberWithUser, InteractionResponse } from './types'

const defaultHeaders = {
  'Content-Type': 'application/json',
  'User-Agent': config.discord.userAgent,
}

// deno-lint-ignore no-explicit-any
export async function botRespond(interactionId: string, token: string, body: any): Promise<void> {
  await request({
    url: urlJoin(config.discord.apiHost, 'interactions', interactionId, token, 'callback'),
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify(snakeCase(body)),
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
      type: DiscordInteractionResponseTypes.DeferredChannelMessageWithSource,
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
  // deno-lint-ignore no-explicit-any
  body: any
  messageId?: string
}) {
  await request({
    url: urlJoin(config.discord.apiHost, 'webhooks', applicationId, token, 'messages', messageId),
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(snakeCase(body)),
  })

  // console.log('discord', res.status, await res.text())
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

  return asGuildMember(guildId.toString(), camelCase(res.data) as GuildMemberWithUser)
}

export function asGuildMember(guildId: string, member: GuildMemberWithUser): GuildMember {
  return {
    id: member.user.id,
    guildId: guildId,
    username: member?.nick ?? member.user?.username,
    joinedAt: member.joinedAt,
  }
}

export function ackButton() {
  return {
    type: DiscordInteractionResponseTypes.DeferredUpdateMessage,
  }
}

export function message(
  content?: string,
  {
    isPrivate = false,
    type = DiscordInteractionResponseTypes.ChannelMessageWithSource,
  }: { isPrivate?: boolean; type?: DiscordInteractionResponseTypes } = {}
) {
  return {
    type,
    data: {
      content,
      flags: isPrivate ? 64 : undefined,
    },
  } as InteractionResponse
}

export function privateMessage(content: string): InteractionResponse {
  return {
    type: DiscordInteractionResponseTypes.ChannelMessageWithSource,
    data: {
      content,
      flags: 64, // private
    },
  } as InteractionResponse
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
