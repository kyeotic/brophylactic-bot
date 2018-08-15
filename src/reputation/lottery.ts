import { Guild, GuildMember, Message, MessageReaction, User } from 'discord.js'
import HighResTimeout from 'high-res-timeout'
import throttle from 'p-throttle'
import R from 'ramda'
import { CommandModule } from 'yargs'
import { IAppContext } from '../context'
import { delay } from '../util/delay'
import { isReactionTo } from '../util/messages'
import { inclusiveRange } from '../util/random'

export function lotteryCommand(context: IAppContext): CommandModule {
  return {
    command: 'lottery <amount>',
    describe: 'Starts a lottery with the server.',
    builder: yargs =>
      yargs.positional('amount', {
        description: 'amount of rep to bet. Cannot exceed your total rep.',
        type: 'number'
      }),
    handler: argv => {
      console.log('handling lottery', argv.amount)
      argv.promisedResult = lotteryHandler(context, argv)
      return argv.promisedResult
    }
  }
}

const lotteryTimeSeconds = 30
export async function lotteryHandler(
  context: IAppContext,
  { message, amount }: { message: Message; amount: number }
) {
  // Init
  const {
    stores: { reputation }
  } = context
  const { channel, member, guild } = message
  const { client } = channel

  // Validate
  if (!amount || Number.isNaN(amount)) {
    return
  }

  if (!Number.isInteger(amount)) {
    return await channel.send('amount must be an integer')
  }

  // Require user has enough rep to bet
  let bgr = await reputation.getUserRep(member)
  if (bgr < 0 || bgr < amount) return notEnoughRep(member, bgr, amount)

  // Setup lotery
  let lottery = new Map<string, GuildMember>()
  lottery.set(member.displayName, member)

  let banner = (timeRemaining: number) =>
    `${
      member.displayName
    } now started a lottery for ℞${amount}. React to this message with an emoji within ${timeRemaining} seconds to place an equal bet and join the lottery.`

  // Create a message to track reactions
  let lotteryMessage = (await channel.send(
    banner(lotteryTimeSeconds)
  )) as Message
  // For testing
  let mur = await guild.members.find(m => m.displayName === 'Mur')
  lottery.set(mur.displayName, mur)

  let match = R.curry(isReactionTo)(lotteryMessage)

  let reactionHandler = async (reaction: MessageReaction, user: User) => {
    // Can't register handler for specific message, so filter everything else out
    if (!match(reaction)) return
    let newMember = await guild.fetchMember(user)
    let name = newMember.displayName
    // Can only bet once
    if (lottery.has(name)) return
    // Need enough rep
    let rep = await reputation.getUserRep(newMember)
    if (rep < amount) {
      return await channel.send(notEnoughRep(newMember, rep, amount))
    }
    // Add to lottery
    lottery.set(name, newMember)
  }
  let unreactionHandler = async (reaction: MessageReaction, user: User) => {
    if (!match(reaction)) return
    let newMember = await guild.fetchMember(user)
    // The player who started the lottery cannot withdraw
    if (newMember.id === member.id) return
    lottery.delete(newMember.displayName)
  }

  // Register Listeners
  client.on('messageReactionAdd', reactionHandler)
  client.on('messageReactionRemove', unreactionHandler)

  await delay(lotteryTimeSeconds * 1000)

  // Cleanup Listeners
  client.removeListener('messageReactionAdd', reactionHandler)
  client.removeListener('messageReactionRemove', unreactionHandler)

  // Require at least two people
  if (lottery.size < 2) return `The lottery has ended. Not enough members bet.`

  // Select a winner
  let names = Array.from(lottery.keys())
  let winner = lottery.get(names[inclusiveRange(0, names.length - 1)])
  lottery.delete(winner.displayName)

  // Send winningsa
  await reputation.transferUserRep(winner, Array.from(lottery.values()), amount)
  let newBgr = await reputation.getUserRep(winner)
  return `The lottery has ended. ${names.join(', ')} all bet ℞${amount}. ${
    winner.displayName
  } won ℞${amount * (lottery.size + 1)} and now has ℞${newBgr}.`
}

function notEnoughRep(member: GuildMember, bgr: number, amount: number) {
  return `${
    member.displayName
  } only has ${bgr} and cannot bet in a lottery for ℞${amount}`
}
