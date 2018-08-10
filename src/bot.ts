import { Client, Guild, Message } from 'discord.js'
import config from './config'

import { Argv } from 'yargs'

import { makeContext } from './context'
import { asMarkdown } from './util/messages'
import { getResidentRole, hasRole } from './util/roles'
import parse from './util/shellParse'

import handleNewUser from './commands/newUser'
import promoteCommand from './commands/promotion'
import rollCommand from './commands/roll'
import { bgrCommand } from './reputation/bgr'
import { lotteryCommand } from './reputation/lottery'

const yargs = require('yargs/yargs')

const commandCharacter = '!'
const bot = new Client()

export const start = () => bot.login(config.discord.botToken)

bot.on('guildMemberAdd', handleNewUser)

bot.on('message', async (message: Message) => {
  let { content, channel, guild, member } = message
  if (!content || !content.startsWith(commandCharacter + ' ')) return
  const context = makeContext()
  let command: string[]

  try {
    command = parse(content.substring(2))
  } catch (e) {
    console.error(e)
    await channel.send('Unsafe input: do not use shell metacharacters')
    return
  }

  // Check permission
  if (!hasRole(member, getResidentRole(guild))) {
    return
  }

  ;(yargs() as Argv)
    .scriptName(commandCharacter)
    .command(rollCommand())
    .command(promoteCommand(guild))
    .command(bgrCommand(context))
    .command(lotteryCommand(context))
    .demandCommand(1, 'Must provide at least one command')
    .recommendCommands()
    .strict()
    .exitProcess(false)
    .help()
    .fail(async (help, error) => {
      console.log('fail handler ', help, error)
      await channel.send(asMarkdown(error ? error.toString() : help))
    })
    .parse(command as string[], { message }, async (err, argv, output) => {
      // Hack to get around parse not waiting for promises
      if (argv.promisedResult) {
        await argv.promisedResult.catch((e: Error) => {
          err = e
        })
      }
      if (err) {
        console.log('parse error')
        return await notifyOwner(err, message)
      }
      if (output) {
        await channel.send(asMarkdown('output' + output))
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
