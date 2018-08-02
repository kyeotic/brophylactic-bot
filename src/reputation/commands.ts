import { GuildMember, Message } from 'discord.js'
import moment from 'moment'
import R from 'ramda'
import { CommandModule } from 'yargs'

export function bgpCommand(): CommandModule {
  return {
    command: 'bgr',
    describe: 'Brophylactic Gaming Reputation, the server currency',
    builder: yargs =>
      yargs.option('send', {
        alias: 's',
        desc: 'Send BGP to a user',
        type: 'string',
        demandOption: false
      }),
    handler: argv => {
      argv.promisedResult = bgpHandler(argv)
    }
  }
}

const millisecondsInADay = 86400000

export async function bgpHandler({
  message,
  send
}: {
  message: Message
  send: string
}) {
  // Init
  const { channel, member } = message

  // Currently BGP is just a server age value
  let bgp = calculateBgpFromJoinedDate(member)
  let joined = moment(member.joinedAt).format('YYYY-MM-DD')
  await channel.send(`${member.displayName} joined on ${joined} has ℞${bgp}`)
  console.log()
}

function calculateBgpFromJoinedDate(member: GuildMember) {
  return Math.floor(
    (Date.now() - member.joinedAt.getTime()) / millisecondsInADay
  )
}
