import {
  Client,
  Guild,
  GuildMember,
  Message,
  Role,
  TextChannel
} from 'discord.js'
import {
  equals,
  filter,
  length,
  map,
  minBy,
  pick,
  pipe,
  prop,
  reduce,
  reject
} from 'ramda'
import config from './config'

const bot = new Client()

export const start = () => bot.login(config.discord.botToken)

const userRolesFilter = filter(
  (r: Role) => r.name !== '@everyone' && !r.managed
)

bot.on('ready', () => {
  console.log('Ready!')
  // let guild = bot.guilds.get(config.discord.serverId)
  // console.log(
  //   'assigning',
  //   guild.members.filter(m => m.roles.length === 0).length
  // )
  // await guild.members
  //   .filter(m => m.roles.length === 0)
  //   .map(m =>
  //     guild.addMemberRole(m.id, config.discord.newMemberRoleId, 'missing role')
  // )
  // console.log('assignment done')

  // bot.guilds.forEach(guild => {
  //   console.log(guild.name)
  //   console.log(guild.memberCount, [...guild.members.values()].length)
  // })
  console.log(
    bot.guilds.map(pick(['name', 'id'])),
    bot.guilds.map(
      pipe(
        getIntroRole,
        pick(['id', 'name', 'calculatedPosition'])
      )
    )
    // bot.guilds
    //   .first()
    //   .members.map(pick(['id', 'displayName', 'roles']))
    //   .map((m: any) => ({
    //     ...m,
    //     roles: map(prop('name'), userRolesFilter([...m.roles.values()]))
    //   }))
  )
  // bot.createMessage('472286758030147588', `Hey $test, welcome to the server!`)
})
bot.on('guildMemberAdd', assignNewUser)
bot.on('message', async (message: Message) => {
  const { member, guild } = message
  // New user
  if (message.content === '!debug-add' && member.id === guild.ownerID) {
    await assignNewUser(member)
  } else if (message.content && message.content.startsWith('!promote')) {
    await handlePromotion(member, message)
  }
})

async function assignNewUser(member: GuildMember): Promise<void> {
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

async function handlePromotion(member: GuildMember, message: Message) {
  // Init
  const { channel, guild } = message
  const residentRole = getResidentRole(guild)
  const newMemberRole = getIntroRole(guild)
  const username = message.content.replace('!promote ', '')

  // Residents Only
  if (!isResident(member)) {
    console.log('check fail', residentRole.name, hasIntroRole(member))
    channel.send(`Promote can only be used by a ${residentRole.name}`)
    return
  }

  // Find User
  const memberToPromote = guild.members.find(m => m.displayName === username)
  if (!memberToPromote) {
    channel.send(`Unable to find member with the username ${username}`)
    return
  }

  // Interns Only
  if (!hasIntroRole(memberToPromote)) {
    channel.send(
      `Promote can only be used to promote from ${newMemberRole.name} to ${
        residentRole.name
      }`
    )
    return
  }

  // Promote
  try {
    await memberToPromote.addRole(residentRole.id, 'promotion')
    await memberToPromote.removeRole(newMemberRole.id, 'promotion')
    channel.send(
      `Promoted ${memberToPromote.displayName} to ${residentRole.name}`
    )
  } catch (e) {
    console.error(e, e.stack)
  }
}

/**
 * Check if a user has the intro role for a server
 *
 * @param {GuildMember} member
 * @returns {boolean}
 */
function hasIntroRole(member: GuildMember): boolean {
  return member.roles.has(getIntroRole(member.guild).id)
}

/**
 * Return the lowest non-managed, non @everyone role for the server
 *
 * @param {Guild} guild
 * @returns {Role}
 */
function getIntroRole(guild: Guild): Role {
  return pipe(
    userRolesFilter,
    reduce(minBy((r: Role) => r.calculatedPosition), {
      calculatedPosition: Infinity
    } as Role)
  )(Array.from(guild.roles.values()))
}

/**
 * Check if a member is has a non-intro role (they are a "known member" of the server)
 *
 * @param {GuildMember} member
 * @returns {boolean}
 */
function isResident(member: GuildMember): boolean {
  return length(userRolesFilter(member.roles.array())) && !hasIntroRole(member)
}

function getResidentRole(guild: Guild): Role {
  return pipe(
    userRolesFilter,
    reject(equals(getIntroRole(guild))),
    reduce(minBy((r: Role) => r.calculatedPosition), {
      calculatedPosition: Infinity
    } as Role)
  )(Array.from(guild.roles.values()))
}
