import { Message } from 'discord.js'
import { format } from 'date-fns'
import { CommandModule } from 'yargs'
import { IAppContext } from '../context'

export function bgrCommand(context: IAppContext): CommandModule {
  return {
    command: 'bgr <command>',
    describe: 'Brophylactic Gaming Reputation (℞), the server currency',
    builder: (yargs) =>
      yargs
        .command({
          command: 'send [to] [amount]',
          describe: 'send ℞',
          builder: (y) =>
            y
              .positional('to', {
                description: 'Send BGR to a user',
                type: 'string',
                implies: 'amount',
              })
              .positional('amount', {
                description: 'amount of BGR to send',
                type: 'number',
              }),
          handler: handleWrapper(context),
        })
        .command({
          command: 'view',
          describe: 'view ℞',
          handler: handleWrapper(context),
        })
        .demandCommand(1, 'use a subcommand, or --help for options'),
    // tslint:disable-next-line:no-empty
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    handler: () => {},
  }
}

function handleWrapper(context: IAppContext) {
  return (argv: any) => {
    argv.promisedResult = bgrHandler(context, argv)
    return argv.promisedResult
  }
}

export async function bgrHandler(
  context: IAppContext,
  { message, to, amount }: { message: Message; to: string; amount: number }
) {
  // Init
  const { channel, member, guild } = message
  const {
    stores: { reputation },
  } = context

  if (!member || !guild) {
    await channel.send('Guild context missing')
    return
  }

  const bgr = await reputation.getUserRep(member)
  if (!to) {
    const joined = member.joinedAt ? format(member.joinedAt, 'yyyy-MM-dd') : '<join date missing>'
    await channel.send(`${member.displayName} joined on ${joined} has ℞${bgr}`)
    return
  }
  // Find the user
  const memberToReceive = guild.members.cache.find((m) => m.displayName === to)
  if (!memberToReceive) {
    await channel.send(`Unable to find member with the username ${to}`)
    return
  }
  if (memberToReceive.id == member.id) {
    await channel.send(`Unable to send ℞ to yourself`)
    return
  }
  const sendMessage = (await channel.send(
    `${member.displayName} is sending ${memberToReceive.displayName} ℞${amount}`
  )) as Message
  await reputation.transferUserRep(member, memberToReceive, amount)
  const [senderRep, receiverRep] = await Promise.all([
    reputation.getUserRep(member),
    reputation.getUserRep(memberToReceive),
  ])
  await sendMessage.edit(
    `${member.displayName} sent ${memberToReceive.displayName} ℞${amount}. ${member.displayName}: ℞${senderRep}, ${memberToReceive.displayName}: ℞${receiverRep}`
  )
  // pause cleanup
  // await message.delete()
}
