import { Guild, GuildMember, Message, MessageReaction, User } from 'discord.js'
import { CommandModule } from 'yargs'
import { IAppContext } from '../context'
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
      console.log('handling lottery')
      argv.promisedResult = lotteryHandler(context, argv)
      return argv.promisedResult
    }
  }
}

const lotteryWaitTime = 30
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

  if (!amount || Number.isNaN(amount)) {
    return
  }

  let bgr = await reputation.getUserRep(member)
  if (bgr < amount) {
    return await channel.send(notEnoughRep(member, bgr, amount))
  }
  let lottery = new Map<string, GuildMember>()
  lottery.set(member.displayName, member)

  let lotteryMessage = (await channel.send(
    `${
      member.displayName
    } now started a lottery for ℞${amount}. React to this message with an emoji within ${lotteryWaitTime} seconds to place an equal bet and join the lottery.`
  )) as Message
  // For tetsing
  // let mur = await guild.members.find(m => m.displayName === 'Mur')
  // lottery.set(mur.displayName, mur)

  let reactionHandler = async (
    messageReaction: MessageReaction,
    user: User
  ) => {
    // Can't register handler for specific message, so filter everything else out
    if (lotteryMessage.id !== messageReaction.message.id) return
    let newMember = await guild.fetchMember(user)
    let name = newMember.displayName
    // Can only bet once
    if (lottery.has(name)) return
    // Need enough rep
    let rep = await reputation.getUserRep(newMember)
    if (rep < amount) {
      return await channel.send(notEnoughRep(member, rep, amount))
    }
    // Add to lottery
    lottery.set(name, newMember)
  }
  let unreactionHandler = async (
    messageReaction: MessageReaction,
    user: User
  ) => {
    if (lotteryMessage.id !== messageReaction.message.id) return
    let newMember = await guild.fetchMember(user)
    // The player who started the lottery cannot withdraw
    if (newMember.id === member.id) return
    lottery.delete(newMember.displayName)
  }
  let finishHandler = async () => {
    client.removeListener('messageReactionAdd', reactionHandler)
    client.removeListener('messageReactionRemove', unreactionHandler)
    if (lottery.size < 2) {
      return await channel.send(
        `The lottery has ended. Not enough members bet.`
      )
    }
    let names = Array.from(lottery.keys())
    let winner = lottery.get(names[inclusiveRange(0, names.length - 1)])
    lottery.delete(winner.displayName)
    await reputation.transferUserRep(
      winner,
      Array.from(lottery.values()),
      amount
    )
    let newBgr = await reputation.getUserRep(winner)
    await channel.send(
      `The lottery has ended. ${names.join(', ')} all bet ℞${amount}. ${
        winner.displayName
      } won ℞${amount * (lottery.size + 1)} and now has ℞${newBgr}.`
    )
  }
  client.on('messageReactionAdd', reactionHandler)
  client.on('messageReactionRemove', unreactionHandler)

  setTimeout(finishHandler, lotteryWaitTime * 1000)

  // let joined = moment(member.joinedAt).format('YYYY-MM-DD')
}

function notEnoughRep(member: GuildMember, bgr: number, amount: number) {
  return `${
    member.displayName
  } only has ${bgr} and cannot bet in a lottery for ℞${amount}`
}
