import { Message, MessageReaction } from 'discord.js'

export function asMarkdown(str: string) {
  return '```' + str + '```'
}

export function equals(a: Message, b: Message) {
  return a.id === b.id
}

export function isReactionTo(message: Message, reaction: MessageReaction) {
  return message.id === reaction.message.id
}
