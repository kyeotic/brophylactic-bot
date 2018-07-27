'use strict'

const config = require('./config')
const Eris = require('eris')
const { pick } = require('ramda')
const bot = new Eris(config.discord.botToken)
// const client = new Eris(`Bot ${config.discord.botToken}`, { restMode: true })

// const broServer = new Eris.Guild(config.discord.serverId)
// console.log(broServer)

module.exports = {
  start: () => bot.connect()
}

bot.on('ready', async () => {
  console.log('Ready!')
  let guild = bot.guilds.get(config.discord.serverId)
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
    bot.guilds.get(config.discord.serverId).name,
    bot.guilds
      .get(config.discord.serverId)
      .roles.map(pick(['name', 'id', 'color']))
  )
  // bot.createMessage('472286758030147588', `Hey $test, welcome to the server!`)
})
bot.on('guildMemberAdd', async (guild, member) => {
  if (guild && guild.id === config.discord.serverId) {
    await assignNewUser({ bot, guild, member })
  }
})
bot.on('messageCreate', async msg => {
  let {
    member,
    channel: { guild }
  } = msg
  // Only operator on our server
  if (guild.id !== config.discord.serverId) return
  // New user
  if (msg.content === '!debug-add' && member.id === guild.ownerID) {
    await assignNewUser({ bot, guild, member })
  } else if (msg.content && msg.content.startsWith('!promote')) {
    await handlePromotion({ bot, guild, member, msg })
  }
})

async function assignNewUser({ bot, guild, member }) {
  let role = guild.roles.get(config.discord.newMemberRoleId)
  await guild.addMemberRole(member.id, role.id, 'joined server')
  let channel = guild.channels.find(c => c.name === 'general')
  bot.createMessage(
    channel.id,
    `${member.username} joined ${
      channel.guild.name
    } and has been assigned to the ${role.name} role`
  )
}

async function handlePromotion({ bot, guild, msg, member }) {
  // Init
  let { channel } = msg
  let residentRole = guild.roles.get(config.discord.residentRoleId)
  let newMemberRole = guild.roles.get(config.discord.newMemberRoleId)
  let username = msg.content.replace('!promote ', '')

  // Residents Only
  if (!member.roles.find(r => r === config.discord.residentRoleId)) {
    bot.createMessage(
      channel.id,
      `Promote can only be used by a ${residentRole.name}`
    )
    return
  }

  // Find User
  let memberToPromote = guild.members.find(m => m.username === username)
  if (!memberToPromote) {
    bot.createMessage(
      channel.id,
      `Unable to find member with the username ${username}`
    )
    return
  }

  // Interns Only
  if (!memberToPromote.roles.find(r => r === config.discord.newMemberRoleId)) {
    bot.createMessage(
      channel.id,
      `Promote can only be used to promote from ${newMemberRole.name} to ${
        residentRole.name
      }`
    )
    return
  }

  // Promote
  await memberToPromote.addRole(residentRole.id, 'promotion')
  await memberToPromote.removeRole(newMemberRole.id, 'promotion')
  bot.createMessage(
    channel.id,
    `Promoted ${memberToPromote.username} to ${residentRole.name}`
  )
}
