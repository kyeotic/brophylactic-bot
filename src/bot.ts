import { Client, Guild, Message } from 'discord.js'
import config from './config'

import yargs from 'yargs'

import { asMarkdown } from './utils/messages'
import { getResidentRole, hasRole } from './utils/roles'
import parse from './utils/shellParse'

import handleNewUser from './commands/newUser'
import promoteCommand from './commands/promotion'
import rollCommand from './commands/roll'

const commandCharacter = '!'
const bot = new Client()

export const start = () => bot.login(config.discord.botToken)

bot.on('guildMemberAdd', handleNewUser)

bot.on('message', async (message: Message) => {
  let { content, channel, guild, member } = message
  if (!content || !content.startsWith(commandCharacter + ' ')) return
  let command: string[]

  try {
    command = parse(content.substring(2))
  } catch (e) {
    console.error(e)
    await channel.send('Unsafe input: do not use shell metacharacters')
    return
  }

  // Check permission
  if (!hasRole(member, getResidentRole(guild))) return

  yargs
    .scriptName(commandCharacter)
    .command(rollCommand())
    .command(promoteCommand(guild))
    .demandCommand(1, 'Must provide at least one command')
    .recommendCommands()
    .help()
    .fail((_, error) => notifyOwner(error, message))
    .parse(command as string[], { message }, async (err, argv, output) => {
      // Hack to get around parse not waiting for promises
      if (argv.promisedResult) {
        await argv.promisedResult.catch((e: Error) => {
          err = e
        })
      }
      if (err) {
        notifyOwner(err, message)
        return
      }
      if (output) {
        await channel.send(asMarkdown(output))
      }
    })
})

async function notifyOwner(error: Error, message: Message) {
  let { content, channel, guild, member } = message
  console.log('error', error)
  await channel.send(
    `I encounted an error. I will let <@${guild.ownerID}> know`
  )
  let owner = await guild.fetchMember(guild.ownerID)
  owner.send(
    `Error from ${member.displayName} when running: ${asMarkdown(
      content
    )} Error: ${asMarkdown(error.message)}`
  )
}

// Debug Shit
//

bot.on('ready', () => {
  console.log('Ready!')

  // console.log(
  //   bot.guilds.map(R.pick(['name', 'id'])),
  //   bot.guilds.map(
  //     R.pipe(
  //       getIntroRole,
  //       R.pick(['id', 'name', 'calculatedPosition'])
  //     )
  //   )
  // )
})
