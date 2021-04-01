import { Guild, Message, Role } from 'discord.js'
import { CommandModule } from 'yargs'

import { getIntroRole, getResidentRole, hasRole } from '../util/roles'

export default function promoteCommand(guild: Guild): CommandModule {
  const residentRole = getResidentRole(guild)
  const introRole = getIntroRole(guild)
  return {
    command: 'promote <username>',
    describe: `Promote a ${introRole.name} to a ${residentRole.name}`,
    builder: (yargs) =>
      yargs.positional('username', {
        describe: 'A username or nickname',
      }),
    handler: (argv: any) => {
      argv.promisedResult = handlePromotion(residentRole, introRole, argv)
    },
  }
}

export async function handlePromotion(
  residentRole: Role,
  introRole: Role,
  { message, username }: { message: Message; username: string }
): Promise<void> {
  // if (!message.content || !message.content.startsWith('!promote')) return
  // Init
  const { channel, guild, member } = message

  // const username = message.content.replace('!promote ', '')

  if (!member || !guild) {
    channel.send('Guild context missing')
    return
  }

  channel.send(`${residentRole.name} ${introRole.name}`)

  // Residents Only
  if (!hasRole(member, residentRole)) {
    channel.send(`Promote can only be used by a ${residentRole.name}`)
    return
  }

  // Find User
  const members = await guild.members.fetch({ query: username })
  const memberToPromote = members.find((m) => m.displayName === username)
  if (!memberToPromote) {
    console.log(members.map((m) => JSON.stringify(m)))
    channel.send(`Unable to find member with the username ${username}`)
    return
  }

  // Interns Only
  if (!hasRole(memberToPromote, introRole)) {
    channel.send(
      `Promote can only be used to promote from ${introRole.name} to ${residentRole.name}`
    )
    return
  }

  // Promote
  try {
    await memberToPromote.roles.add(residentRole.id, 'promotion')
    await memberToPromote.roles.remove(introRole.id, 'promotion')
    channel.send(`Promoted ${memberToPromote.displayName} to ${residentRole.name}`)
  } catch (e) {
    console.error(e, e.stack)
  }
}
