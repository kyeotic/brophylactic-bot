import config from '../config'
import urlJoin from 'url-join'
import request, { isErrorStatus } from 'request-micro'
import { InteractionResponseType, ComponentType, ButtonStyle, MessageComponents } from './types'
import type {
  GuildMember,
  DiscordGuildMemberWithUser,
  MessageResponse,
  Command,
  APIInteractionGuildMember,
  DiscordGuildMember,
} from './types'
import type { AppLogger } from '../di'

const defaultHeaders = {
  'Content-Type': 'application/json',
  'User-Agent': config.discord.userAgent,
}

export class DiscordClient {
  private readonly config: typeof config['discord']
  private readonly logger: AppLogger

  constructor({
    config: clientConfig,
    logger,
  }: {
    config: typeof config['discord']
    logger: AppLogger
  }) {
    this.config = clientConfig
    this.logger = logger
  }

  async botRespond(interactionId: string | bigint, token: string, body: any): Promise<void> {
    await this.send({
      url: this.api('interactions', interactionId.toString(), token, 'callback'),
      body,
    })
  }

  async updateInteraction({
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
    await this.send({
      url: this.api('webhooks', applicationId, token, 'messages', messageId),
      method: 'PATCH',
      body,
    })
  }

  async getGuildMember(guildId: string | bigint, userId: string | bigint): Promise<GuildMember> {
    const user = await this.send<DiscordGuildMemberWithUser>({
      url: this.api('guilds', guildId.toString(), 'members', userId.toString()),
    })

    return asGuildMember(guildId.toString(), user)
  }

  async getCommands(applicationId: string, guildId?: string): Promise<Command[]> {
    return this.send<Command[]>({
      method: 'GET',
      useBotToken: true,
      url: guildId
        ? this.api('applications', applicationId, 'guilds', guildId, 'commands')
        : this.api('applications', applicationId, 'commands'),
    })
  }

  async deployCommand({
    applicationId,
    guildId,
    command,
  }: {
    applicationId: string
    guildId?: string
    command: any
  }): Promise<void> {
    console.log('deploy', applicationId, guildId, command, this.config.botToken)
    await this.send({
      useBotToken: true,
      url: guildId
        ? this.api('applications', applicationId, 'guilds', guildId, 'commands')
        : this.api('applications', applicationId, 'commands'),
      body: command,
    })
  }

  async deleteCommand({
    applicationId,
    guildId,
    commandId,
  }: {
    applicationId: string
    guildId?: string
    commandId: string
  }): Promise<void> {
    await this.send({
      useBotToken: true,
      method: 'DELETE',
      url: guildId
        ? this.api('applications', applicationId, 'guilds', guildId, 'commands', commandId)
        : this.api('applications', applicationId, 'commands', commandId),
    })
  }

  private async send<T>({
    url,
    method = 'POST',
    headers,
    body,
    useBotToken = false,
  }: {
    url: string
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    headers?: Record<string, string>
    body?: Record<string, any>
    useBotToken?: boolean
  }) {
    headers = { ...defaultHeaders, ...headers }
    if (useBotToken) {
      headers.Authorization = `Bot ${this.config.botToken}`
    }

    const response = await request({ url, method, body, headers, json: true })

    if (isErrorStatus(response)) {
      this.logger.error('Discord Error', response.statusCode, response.data)
      this.logger.debug('Headers', response.headers)
      throw new Error(JSON.stringify(response.data))
    }

    return response.data as T
  }

  api(...paths: string[]): string {
    return urlJoin(config.discord.apiHost, ...paths)
  }
}

export function asGuildMember(guildId: string, member: DiscordGuildMemberWithUser): GuildMember {
  return {
    id: member.user.id,
    guildId: guildId,
    username: member?.nick ?? member.user?.username,
    joinedAt: member.joined_at,
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
    components,
  }: { isPrivate?: boolean; type?: InteractionResponseType; components?: MessageComponents } = {}
): MessageResponse {
  if (nonMessageTypes.includes(type)) {
    throw new Error('Invalid interaction type for message response')
  }
  return {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    type,
    data: {
      content,
      components,
      flags: isPrivate ? 64 : undefined,
    },
  }
}

export function messageButton(
  id: string,
  label: string,
  { style = ButtonStyle.Primary }: { style?: Exclude<ButtonStyle, ButtonStyle.Link> } = {}
): MessageComponents {
  return [
    {
      type: ComponentType.ActionRow,
      components: [
        {
          label,
          type: ComponentType.Button,
          style,
          custom_id: id,
        },
      ],
    },
  ]
}

export function bgrLabel(
  amount: string | number,
  { bold = true }: { bold?: boolean } = {}
): string {
  return bold ? `**℞${amount.toString()}**` : `℞${amount.toString()}`
}

export function mention(
  user: GuildMember | DiscordGuildMember | DiscordGuildMemberWithUser | APIInteractionGuildMember
): string {
  let id
  if ((user as DiscordGuildMember).user?.id) id = (user as DiscordGuildMember).user?.id
  else if ((user as GuildMember).id) id = (user as GuildMember).id
  else {
    console.error('Unknown user type', user)
    throw new Error('Unknown user type')
  }
  return `<@${id}>`
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
