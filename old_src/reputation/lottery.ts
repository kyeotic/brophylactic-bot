import { GuildMember, Message, MessageReaction, User } from 'discord.js'
import { CommandModule } from 'yargs'
import { IAppContext } from '../context'
import { delay } from '../util/delay'
import { isReactionTo } from '../util/messages'
import { randomInclusive } from '../util/random'
import { ReputationStore } from './store'

export function lotteryCommand(context: IAppContext): CommandModule {
  return {
    command: 'lottery <amount> [playerLimit]',
    describe: 'Starts a lottery with the server.',
    builder: (yargs) =>
      yargs
        .positional('amount', {
          description:
            'amount of rep to bet. Cannot exceed your total rep. If negative it cannot exceed (playerLimit * amount) your total tep',
          demandOption: true,
          type: 'number',
        })
        .positional('playerLimit', {
          description:
            'maximum number of players allowed to join negative lottery (bet is amount * playersInLottery)',
          type: 'number',
        }),
    handler: (argv: any) => {
      console.log('handling lottery', argv.amount, argv.playerLimit)
      argv.promisedResult = lotteryHandler(context, argv)
      return argv.promisedResult
    },
  }
}

const lotteryTimeSeconds = 30
export async function lotteryHandler(
  context: IAppContext,
  { message, amount, playerLimit }: { message: Message; amount: number; playerLimit?: number }
) {
  // Init
  const {
    stores: { reputation },
  } = context
  const { channel, member, guild } = message
  const { client } = channel

  if (!member || !guild) {
    await channel.send('Guild context missing')
    return
  }

  // Validate
  if (!amount || Number.isNaN(amount)) {
    return
  }

  if (!Number.isInteger(amount) && amount !== 0) {
    return await channel.send('amount must be a non-zero integer')
  }

  const isNegativeLottery = amount < 0

  if (isNegativeLottery && !playerLimit) {
    return await channel.send('player limit is required for negative lotteries')
  }

  const potSize = isNegativeLottery ? getPotSize(amount, playerLimit) : amount

  // Require user has enough rep to bet
  const bgr = await reputation.getUserRep(member)

  if (bgr < potSize) return notEnoughRep(member, bgr, amount, playerLimit)

  // Setup lottery
  const lottery = new Map<string, GuildMember>()
  lottery.set(member.displayName, member)

  const banner = (timeRemaining: number) =>
    isNegativeLottery
      ? `${member.displayName} now started a negative lottery for ℞${amount} for up to ${playerLimit} players. React to this message with an emoji within ${timeRemaining} seconds to place join the lottery. The loser will pay all other players ℞${amount} for a maximum loss of ℞${potSize}`
      : `${member.displayName} now started a lottery for ℞${amount}. React to this message with an emoji within ${timeRemaining} seconds to place an equal bet and join the lottery.`

  // Create a message to track reactions
  const lotteryMessage = (await channel.send(banner(lotteryTimeSeconds))) as Message
  // For testing
  // let mur = await guild.members.find(m => m.displayName === 'Mur')
  // lottery.set(mur.displayName, mur)

  const match = (reaction: MessageReaction): boolean => isReactionTo(lotteryMessage, reaction)

  const reactionHandler = async (reaction: MessageReaction, user: User): Promise<void> => {
    // Can't register handler for specific message, so filter everything else out
    if (!match(reaction)) return
    const newMember = await guild.members.fetch(user)
    const name = newMember.displayName
    // Can only bet once
    if (lottery.has(name)) return
    // Need enough rep
    const rep = await reputation.getUserRep(newMember)
    if (rep < potSize) {
      await channel.send(notEnoughRep(newMember, rep, amount, playerLimit))
      return
    }
    // Add to lottery
    lottery.set(name, newMember)
  }
  const unreactionHandler = async (reaction: MessageReaction, user: User): Promise<void> => {
    if (!match(reaction)) return
    const newMember = await guild.members.fetch(user)
    // The player who started the lottery cannot withdraw
    if (newMember.id === member.id) return
    lottery.delete(newMember.displayName)
  }

  // Register Listeners
  // @ts-ignore
  client.on('messageReactionAdd', reactionHandler)
  // @ts-ignore
  client.on('messageReactionRemove', unreactionHandler)

  await delay(lotteryTimeSeconds * 1000)

  // Cleanup Listeners
  client.removeListener('messageReactionAdd', reactionHandler)
  client.removeListener('messageReactionRemove', unreactionHandler)

  // Require at least two people
  if (lottery.size < 2) return `The lottery has ended. Not enough members bet.`

  if (isNegativeLottery) return finishNegativeLottery({ lottery, amount, reputation })
  return finishPositiveLottery({ lottery, amount, reputation })
}

function notEnoughRep(member: GuildMember, bgr: number, amount: number, playerLimit?: number) {
  const isNegativeLottery = amount < 0
  if (isNegativeLottery) {
    if (!playerLimit) throw new Error(`playerLimit s required for negative lotteries`)
    return `${
      member.displayName
    } only has ${bgr} and cannot bet in a negative lottery with ${playerLimit} players, since the payout could be up to ℞${getPotSize(
      amount,
      playerLimit
    )}`
  }
  return `${member.displayName} only has ${bgr} and cannot bet in a lottery for ℞${amount}`
}

function getPotSize(amount: number, players?: number) {
  if (!players) {
    if (amount <= 0) throw new Error('pot size requires either a positive amount or a players')
    return amount
  }
  return Math.abs(amount) * (players - 1)
}

async function finishNegativeLottery({
  lottery,
  amount,
  reputation,
}: {
  lottery: Map<string, GuildMember>
  amount: number
  reputation: ReputationStore
}) {
  const absAmount = Math.abs(amount)
  // Select a winner
  const names = Array.from(lottery.keys())
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const loser = lottery.get(names[randomInclusive(0, names.length - 1)])!
  lottery.delete(loser.displayName)

  // Send winnings
  await reputation.transferUsersRep(loser, Array.from(lottery.values()), absAmount)
  const newBgr = await reputation.getUserRep(loser)
  return `The lottery has ended. ${names.join(', ')} all bet ℞${absAmount}. ${
    loser.displayName
  } lost ℞${getPotSize(amount, names.length)} and now has ℞${newBgr}.`
}

async function finishPositiveLottery({
  lottery,
  amount,
  reputation,
}: {
  lottery: Map<string, GuildMember>
  amount: number
  reputation: ReputationStore
}) {
  // Select a winner
  const names = Array.from(lottery.keys())
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const winner = lottery.get(names[randomInclusive(0, names.length - 1)])!
  lottery.delete(winner.displayName)

  // Send winnings
  await reputation.transferUserReps(winner, Array.from(lottery.values()), amount)
  const newBgr = await reputation.getUserRep(winner)
  return `The lottery has ended. ${names.join(', ')} all bet ℞${amount}. ${
    winner.displayName
  } won ℞${amount * (lottery.size + 1)} and now has ℞${newBgr}.`
}
