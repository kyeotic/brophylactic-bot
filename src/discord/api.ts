import config from '../config.ts'
import { urlJoin, rest, endpoints, GuildMemberWithUser } from '../deps.ts'
import type { GuildMember, DiscordGuildMember } from './types.ts'

export async function botRespond(interactionId: string, token: string, body: any): Promise<void> {
  await fetch(urlJoin(config.discord.apiHost, 'interactions', interactionId, token, 'callback'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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
  const res = await fetch(
    urlJoin(config.discord.apiHost, 'webhooks', applicationId, token, 'messages', messageId),
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  console.log(res.status, await res.text())
}

export async function getGuildMember(
  guildId: string | bigint,
  userId: string | bigint
): Promise<GuildMember> {
  const member = await rest.runMethod<GuildMemberWithUser>(
    'get',
    endpoints.GUILD_MEMBER(BigInt(guildId), BigInt(userId))
  )

  return asGuildMember(guildId.toString(), member)
}

export function asGuildMember(guildId: string, member: GuildMemberWithUser): GuildMember {
  return {
    ...member,
    id: member.user.id,
    guildId: guildId,
  }
}
