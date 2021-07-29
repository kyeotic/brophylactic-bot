import { Message } from 'discord.js'
import { CommandModule } from 'yargs'
import { IAppContext } from '../context'
import { isSameDay, startOfDay, formatDistanceToNow } from 'date-fns'
import { seededRandomInclusive } from '../util/random'

const magicNumberReward = 100

export function guessCommand(context: IAppContext): CommandModule {
  return {
    command: 'guess [number]',
    describe: 'Guess your daily 1-100 magic number.',
    builder: (y) =>
      y.positional('number', {
        description: 'number to guess',
        type: 'number',
      }),
    handler: handleWrapper(context),
  }
}

function handleWrapper(context: IAppContext) {
  return (argv: any) => {
    argv.promisedResult = guessHandler(context, argv)
    return argv.promisedResult
  }
}

export async function guessHandler(
  context: IAppContext,
  { message, number: guess }: { message: Message; number: number }
) {
  // Init
  const { channel, member } = message
  const {
    stores: { reputation },
  } = context

  const today = new Date()

  if (!member) {
    await channel.send('Guild context missing')
    return
  }

  const lastGuess = await reputation.getUserLastGuess(member)
  if (!guess) {
    await channel.send(
      `Guess a number between 1-100 to win ℞${magicNumberReward}. Only guess allowed per day.\n${
        member.displayName
      } made their last Guess ${
        lastGuess
          ? `${formatDistanceToNow(lastGuess, { addSuffix: true, includeSeconds: false })}`
          : 'never'
      }`
    )
    return
  }

  if (lastGuess && isSameDay(today, lastGuess)) {
    await channel.send(`${member.displayName} already guessed today`)
    return
  }

  await reputation.setUserLastGuess(member, today)

  const magicNumber = seededRandomInclusive(
    `${member.displayName}:${startOfDay(today).getTime()}`,
    1,
    100
  )

  if (magicNumber === guess) {
    await reputation.addUserRep(member, magicNumberReward)
    await channel.send(
      `${member.displayName} correctly guessed that their number was ${magicNumber} and has been awarded ℞${magicNumberReward}`
    )
  } else {
    await channel.send(
      `${member.displayName} incorrectly guessed that their number was ${guess}, it was ${magicNumber}`
    )
  }
}
