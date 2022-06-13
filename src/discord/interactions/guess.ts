import { formatDistanceToNow, utcToZonedTime, formatWithTimezone } from '../../util/dates'
import { message, asGuildMember } from '../api'
import { randomInclusive } from '../../util/random'
import { ApplicationCommandOptionType } from '../types'

import type { AppContext } from '../../di'
import type {
  Command,
  SlashCommand,
  CommandInteractionInteger,
  DiscordGuildMemberWithUser,
} from '../types'

const magicNumberReward = 1000
const magicNumberRange = 3
const rangeReward = 30
const lastDigitReward = 10
const pairwiseReward = 250

type GuessInteraction = SlashCommand<[CommandInteractionInteger]>

const command: Command<GuessInteraction> = {
  // global: true,
  guild: true,
  description: 'Guess your daily 1-100 magic number',
  options: [
    {
      name: 'number',
      required: true,
      type: ApplicationCommandOptionType.Integer,
      description: 'number to guess',
    },
  ],
  execute: async function (payload: GuessInteraction, context: AppContext) {
    return await handleGuess(payload, context)
  },
}

export default command

async function handleGuess(payload: GuessInteraction, context: AppContext) {
  payload = payload as GuessInteraction
  const timeZone = context.config.discord.timezone

  if (!payload.data?.options?.length || !payload.guild_id) {
    return message('missing required sub-command')
  }
  const guess = payload.data?.options[0].value
  const today = new Date()

  const member = asGuildMember(payload.guild_id, payload.member as DiscordGuildMemberWithUser)
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

  const magicNumber = randomInclusive(1, 100, `${memberName}:${getDayString(timeZone, new Date())}`)

  const isCorrect = magicNumber === guess
  const isWithinRange = isWithin(guess, magicNumber, magicNumberRange)
  const matchedLastDigit = lastDigit(magicNumber) === lastDigit(guess)

  if (isCorrect) {
    await context.userStore.incrementUserRep(member, magicNumberReward)
    return message(
      `${memberName} correctly guessed that their number was ${magicNumber} and has been awarded ℞${magicNumberReward}`
    )
  } else if (isMagicPair(magicNumber, guess)) {
    await context.userStore.incrementUserRep(member, pairwiseReward)
    return message(
      `${memberName} incorrectly guessed that their number was ${guess}, it was ${magicNumber}. However they are magic number pairs and so they have been awarded ℞${pairwiseReward}`
    )
  } else if (isWithinRange) {
    await context.userStore.incrementUserRep(member, rangeReward)
    return message(
      `${memberName} incorrectly guessed that their number was ${guess}, it was ${magicNumber}. However it is within ${magicNumberRange} and so they have been awarded ℞${rangeReward}`
    )
  } else if (matchedLastDigit) {
    await context.userStore.incrementUserRep(member, lastDigitReward)
    return message(
      `${memberName} incorrectly guessed that their number was ${guess}, it was ${magicNumber}. However they matched the last digit and so they have been awarded ℞${lastDigitReward}`
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

/**
 * A Magic Pair occurs when the numbers are reverses of each other.
 * Since 100 and 99 cannot have a reversed pair they are a special case of magic pairs.
 * (Despite all NN pairs, e.g. 88 and 77, lacking a magic pair, only 99 is a special case)
 */
function isMagicPair(a: number, b: number) {
  if ((a === 100 && b === 99) || (a === 99 && b === 100)) return true
  if (reverse(paddedNum(a)) === paddedNum(b)) return true
  return false
}

function paddedNum(num: number): string {
  return String(num).padStart(2, '0')
}

function reverse(str: string): string {
  return str.split('').reverse().join('')
}
