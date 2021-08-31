import { Command } from './mod.ts'
import {
  formatDistanceToNow,
  isSameDay,
  startOfDay,
  DiscordApplicationCommandOptionTypes,
  SlashCommandInteraction,
  GuildMemberWithUser,
  ApplicationCommandInteractionDataOptionInteger,
} from '../../deps.ts'
import { updateInteraction, getGuildMember, asGuildMember } from '../api.ts'
import { getMemberName } from '../../users/store.ts'
import { seededRandomRange } from '../../util/random.ts'

const magicNumberReward = 100

const command: Command = {
  // global: true,
  guild: true,
  description: 'Guess your daily 1-100 magic number',
  options: [
    {
      name: 'number',
      required: true,
      type: DiscordApplicationCommandOptionTypes.Integer,
      description: 'number to guess',
    },
  ],
  execute: async function (payload, context) {
    payload = payload as SlashCommandInteraction

    if (!payload.data?.options?.length || !payload.guildId) {
      return { content: 'missing required sub-command' }
    }
    const guess = (payload.data?.options[0] as ApplicationCommandInteractionDataOptionInteger).value
    const today = new Date()

    const member = asGuildMember(payload.guildId, payload.member as GuildMemberWithUser)
    const memberName = getMemberName(member)
    const lastGuess = await context.userStore.getUserLastGuess(member)

    if (!guess || !Number.isInteger(guess) || guess < 0 || guess > 100) {
      return {
        content: `Guess a number between 1-100 to win ℞${magicNumberReward}. Only guess allowed per day.\n${memberName} made their last Guess ${
          lastGuess
            ? `${formatDistanceToNow(lastGuess, { addSuffix: true, includeSeconds: false })}`
            : 'never'
        }`,
      }
    }

    if (lastGuess && isSameDay(today, lastGuess)) {
      return { content: `${memberName} already guessed today` }
    }

    await context.userStore.setUserLastGuess(member, today)

    const magicNumber = seededRandomRange(`${memberName}:${startOfDay(today).getTime()}`, 1, 100)

    if (magicNumber === guess) {
      await context.userStore.incrementUserRep(member, magicNumber)
      return {
        content: `${memberName} correctly guessed that their number was ${magicNumber} and has been awarded ℞${magicNumberReward}`,
      }
    } else {
      return {
        content: `${memberName} incorrectly guessed that their number was ${guess}, it was ${magicNumber}`,
      }
    }
  },
}

export default command
