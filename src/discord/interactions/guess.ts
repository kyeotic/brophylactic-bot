import { Command, SlashCommand, ApplicationCommandInteractionDataOptionInteger } from '../types.ts'
import {
  formatDistanceToNow,
  DiscordApplicationCommandOptionTypes,
  GuildMemberWithUser,
  utcToZonedTime,
  formatWithTimezone,
} from '../../deps.ts'
import { message, asGuildMember } from '../api.ts'
import { seededRandomRange } from '../../util/random.ts'
import type { AppContext } from '../../context.ts'

const magicNumberReward = 500
const magicNumberRange = 3
const magicNumberRangeReward = 20
const magicNumberFinalDigitReward = 3

type GuessInteraction = SlashCommand<[ApplicationCommandInteractionDataOptionInteger]>

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
    return await handleGuess(payload as GuessInteraction, context)
  },
}

export default command

async function handleGuess(payload: GuessInteraction, context: AppContext) {
  payload = payload as GuessInteraction
  const timeZone = context.config.discord.timezone

  if (!payload.data?.options?.length || !payload.guildId) {
    return message('missing required sub-command')
  }
  const guess = payload.data?.options[0].value
  const today = new Date()

  const member = asGuildMember(payload.guildId, payload.member as GuildMemberWithUser)
  const memberName = member.username
  const lastGuess = await context.userStore.getUserLastGuess(member)

  if (!guess || !Number.isInteger(guess) || guess < 0 || guess > 100) {
    return message(
      `Guess a number between 1-100 to win ℞${magicNumberReward}. Only guess allowed per day.\n${memberName} made their last Guess ${
        lastGuess
          ? `${formatDistanceToNow(lastGuess, { addSuffix: true, includeSeconds: false })}`
          : 'never'
      }`
    )
  }

  if (lastGuess && isToday(timeZone, lastGuess)) {
    return message('You already guessed today', { isPrivate: true })
  }

  await context.userStore.setUserLastGuess(member, today)

  const magicNumber = seededRandomRange(
    `${memberName}:${getDayString(timeZone, new Date())}`,
    1,
    100
  )

  const isCorrect = magicNumber === guess
  const isWithinRange = isWithin(guess, magicNumber, magicNumberRange)
  const matchedLastDigit = lastDigit(magicNumber) === lastDigit(guess)

  if (isCorrect) {
    await context.userStore.incrementUserRep(member, magicNumber)
    return message(
      `${memberName} correctly guessed that their number was ${magicNumber} and has been awarded ℞${magicNumberReward}`
    )
  } else if (isWithinRange) {
    await context.userStore.incrementUserRep(member, magicNumberRangeReward)
    return message(
      `${memberName} incorrectly guessed that their number was ${guess}, it was ${magicNumber}. However it is within ${magicNumberRange} and so they have been awarded ℞${magicNumberRangeReward}`
    )
  } else if (matchedLastDigit) {
    await context.userStore.incrementUserRep(member, magicNumberFinalDigitReward)
    return message(
      `${memberName} incorrectly guessed that their number was ${guess}, it was ${magicNumber}. However they matched the last digit and so they have been awarded ℞${magicNumberFinalDigitReward}`
    )
  } else {
    return message(
      `${memberName} incorrectly guessed that their number was ${guess}, it was ${magicNumber}`
    )
  }
}

// Hacky method to check guess based on configurable timezone
export function isToday(timeZone: string, date: Date): boolean {
  const zonedDay = getDayString(timeZone, new Date())
  const guessDay = getDayString(timeZone, date)

  return zonedDay === guessDay
}

function isWithin(num: number, target: number, range: number): boolean {
  return num >= target - range && num <= target + range
}

function lastDigit(num: number): number {
  return parseFloat(num.toString().slice(-1))
}

function getDayString(timeZone: string, date: Date): string {
  return formatWithTimezone(utcToZonedTime(date, timeZone), 'yyyy-MM-dd', { timeZone })
}
