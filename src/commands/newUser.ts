import { GuildMember, TextChannel } from 'discord.js'
import { getIntroRole, isResident } from '../util/roles'

export default async function assignNewUser(
  member: GuildMember
): Promise<void> {
  // Don't assign enrolled members to the intro role
  if (isResident(member)) return
  const role = getIntroRole(member.guild)
  await member.addRole(role.id, 'joined server')
  const channel = member.guild.channels.find(
    c => c.name === 'general'
  ) as TextChannel
  channel.send(
    `${member.displayName} joined ${
      channel.guild.name
    } and has been assigned to the ${role.name} role`
  )
}
