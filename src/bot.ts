import { Client, Message } from 'discord.js'
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
import { guessCommand } from './reputation/guess'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const yargs = require('yargs/yargs')

const commandCharacter = '!'
const bot = new Client()

export const start = (): Promise<any> => bot.login(config.discord.botToken)

bot.on('guildMemberAdd', handleNewUser)

bot.on('error', (error) => {
  console.error('bot error handler', error.toString(), error.stack)
})

bot.on('message', async (message: Message) => {
  const { content, channel, guild, member } = message
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
  console.log('starting command', command)
  ;(yargs() as Argv)
    .scriptName(commandCharacter)
    .command(rollCommand())
    .command(promoteCommand(guild))
    .command(bgrCommand(context))
    .command(lotteryCommand(context))
    .command(guessCommand(context))
    .demandCommand(1, 'Must provide at least one command')
    .recommendCommands()
    .strict()
    .exitProcess(false)
    .help()
    .fail(async (help: string, error: Error) => {
      console.log('fail handler ', help, error)
      await channel.send(asMarkdown(error ? error.toString() : help))
    })
    .parse(
      command as string[],
      { message },
      async (err: Error | undefined, argv: any, output: string) => {
        // Hack to get around parse not waiting for promises
        let additionalOutput
        if (argv.promisedResult) {
          additionalOutput = await argv.promisedResult.catch((e: Error) => {
            err = e
          })
        }
        console.log('finishing command', command)

        if (err) {
          console.log('parse error')
          return await notifyOwner(err, message)
        }
        if (output) {
          await channel.send(asMarkdown(output))
        }
        if (additionalOutput) {
          await channel.send(additionalOutput)
        }
      }
    )
})

async function notifyOwner(error: Error, message: Message) {
  const { content, channel, guild, member } = message
  console.log('error', error)
  await channel.send(`I encountered an error. I will let <@${guild.ownerID}> know`)
  const owner = await guild.fetchMember(guild.ownerID)
  owner.send(
    `Error from ${member.displayName} when running: ${asMarkdown(content)} Error: ${asMarkdown(
      error.message
    )}`
  )
}

// Debug Shit
//

bot.on('ready', () => {
  console.log('Ready!')
})
