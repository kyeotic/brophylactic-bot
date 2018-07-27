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

bot.on('ready', () => {
  console.log('Ready!')

  // bot.guilds.forEach(guild => {
  //   console.log(guild.name, guild.roles)
  // })
  console.log(
    bot.guilds.map(pick(['name', 'id'])),
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
  if (
    msg.content === '!debug-add' &&
    config.discord.serverId &&
    msg.member.id === msg.channel.guild.ownerID
  ) {
    let {
      member,
      channel: { guild }
    } = msg
    console.log(
      'debug',
      pick(['name', 'id', 'ownerID'], guild),
      pick(['name', 'id'], msg.channel.guild)
    )
    await assignNewUser({ bot, guild, member })
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
