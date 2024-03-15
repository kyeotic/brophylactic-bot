import { formatDistanceToNow } from '../util/dates'
import { isToday, getDayString } from '../util/dates'
import { message, asGuildMember, bgrLabel } from '../discord/api'
import { randomInclusive } from '../util/random'
import { ApplicationCommandOptionType } from '../discord/types'

import type { AppContext } from '../di'
import type {
  SlashCommand,
  SlashCommandOptions,
  CommandInteractionInteger,
  DiscordGuildMemberWithUser,
} from '../discord/types'

const magicNumberReward = 1000
const magicNumberRange = 3
const rangeReward = 30
const lastDigitReward = 10
const pairwiseReward = 250

type GuessInteraction = SlashCommandOptions<[CommandInteractionInteger]>
type Rule = {
  name: string
  predicate: (answer: number, guess: number) => boolean
  reward: number
  message: (opts: { memberName: string; answer: number; guess: number }) => string
}

const rules: Rule[] = [
  {
    name: 'Correct',
    predicate: (answer, guess) => answer === guess,
    reward: magicNumberReward,
    message: ({ memberName, answer }) =>
      `${memberName} correctly guessed that their number was ${answer} and has been awarded ${bgrLabel(
        magicNumberReward
      )}`,
  },
  {
    name: 'Magic Pair',
    predicate: (answer, guess) => isMagicPair(answer, guess),
    reward: magicNumberReward,
    message: ({ memberName, answer, guess }) =>
      `${memberName} incorrectly guessed that their number was ${guess}, it was ${answer}. However they are magic number pairs and so they have been awarded ${bgrLabel(
        pairwiseReward
      )}`,
  },
  {
    name: 'Near Correct',
    predicate: (answer, guess) => isWithin(guess, answer, magicNumberRange),
    reward: rangeReward,
    message: ({ memberName, answer, guess }) =>
      `${memberName} incorrectly guessed that their number was ${guess}, it was ${answer}. However it is within ${magicNumberRange} and so they have been awarded ${bgrLabel(
        rangeReward
      )}`,
  },
  {
    name: 'Last Digit',
    predicate: (answer, guess) => lastDigit(answer) === lastDigit(guess),
    reward: lastDigitReward,
    message: ({ memberName, answer, guess }) =>
      `${memberName} incorrectly guessed that their number was ${guess}, it was ${answer}. However they matched the last digit and so they have been awarded ${bgrLabel(
        lastDigitReward
      )}`,
  },
]

const command: SlashCommand<GuessInteraction> = {
  id: 'guess',
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
  handleSlashCommand: async function (payload: GuessInteraction, context: AppContext) {
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

  if (!guess || !Number.isInteger(guess) || guess < 1 || guess > 100) {
    return message(
      `Guess a number between 1-100 to win ${bgrLabel(
        magicNumberReward
      )}. Only guess allowed per day.\n${memberName} made their last Guess ${
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

  const match = rules.find((r) => r.predicate(magicNumber, guess))

  if (match) {
    await context.userStore.incrementUserRep(member, match.reward)
    return message(match.message({ memberName, answer: magicNumber, guess }))
  } else {
    return message(
      `${memberName} incorrectly guessed that their number was ${guess}, it was ${magicNumber}`
    )
  }
}

function isWithin(num: number, target: number, range: number): boolean {
  return num >= target - range && num <= target + range
}

function lastDigit(num: number): number {
  return parseFloat(num.toString().slice(-1))
}

/**
 * A Magic Pair occurs when the numbers form a gauss sum
 * i.e. the magic number and the guess add up to 101
 */
function isMagicPair(a: number, b: number) {
  return 101 - a === b
}

function paddedNum(num: number): string {
  return String(num).padStart(2, '0')
}

function reverse(str: string): string {
  return str.split('').reverse().join('')
}
