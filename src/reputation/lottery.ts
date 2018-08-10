import { GuildMember, Message, MessageReaction, User } from 'discord.js'
import moment from 'moment'
import R from 'ramda'
import { CommandModule } from 'yargs'
import { IAppContext } from '../context'

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
      console.log('handling')
      argv.promisedResult = lotteryHandler(context, argv)
      return argv.promisedResult
    }
  }
}

export async function lotteryHandler(
  context: IAppContext,
  { message, amount }: { message: Message; amount: number }
) {
  // Init
  const {
    stores: { reputation }
  } = context
  const { channel, member } = message
  const { client } = channel

  if (!amount || Number.isNaN(amount)) {
    return
  }

  let joined = moment(member.joinedAt).format('YYYY-MM-DD')
  let bgr = await reputation.getUserRep(member)
  // await channel.send(
  //   `${member.displayName} joined on ${joined} has ℞${bgr}. Adding 10`
  // )
  // await reputation.setUserRep(member, bgr + 10)
  // bgr = await reputation.getUserRep(member)
  // await channel.send(`${member.displayName} now has ℞${bgr}.`)
  let reactionHandler = async (
    messageReaction: MessageReaction,
    user: User
  ) => {
    channel.send(`${user.username} has accepted the bet`)
  }
  let unreactionHandler = async (
    messageReaction: MessageReaction,
    user: User
  ) => {
    channel.send(`${user.username} has withdrawn`)
  }
  let finishHandler = async () => {
    client.removeListener('messageReactionAdd', reactionHandler)
    client.removeListener('messageReactionRemove', unreactionHandler)
  }
  client.on('messageReactionAdd', reactionHandler)
  client.on('messageReactionRemove', unreactionHandler)

  setTimeout(finishHandler, 10000)

  // let joined = moment(member.joinedAt).format('YYYY-MM-DD')
}
