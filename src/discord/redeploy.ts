/* eslint-disable @typescript-eslint/no-non-null-assertion */
import base64Url from 'base64url'
import { slashCommands } from './interactions'
import config from '../config'
import { deployCommand, getCommands } from './api'
import { SlashCommand } from './types'

const { decode } = base64Url

export async function redeploy() {
  // await cleanupCommands()
  await updateGlobalCommands()
  if (config.discord.serverId) {
    await updateGuildCommands(config.discord.serverId)
  }
  return
}

export async function updateGlobalCommands() {
  await Promise.all(
    [...slashCommands.values()]
      // ONLY GLOBAL COMMANDS
      .filter((command) => command?.global)
      .map((command) => {
        return {
          name: command.id,
          description: command!.description || 'No description available.',
          options: command!.options?.map((option) => {
            const optionName = option.name
            const optionDescription = option.description

            return {
              ...option,
              name: optionName,
              description: optionDescription || 'No description available.',
            }
          }),
        }
      })
      .map((command) =>
        deployCommand({
          applicationId: getApplicationId(),
          command,
          botToken: config.discord.botToken,
        })
      )
  )

  const appCommmands = await getCommands({
    applicationId: getApplicationId(),
    botToken: config.discord.botToken,
  })
  console.log('app commands', appCommmands)
}

export async function updateGuildCommands(guildId: string) {
  await Promise.all(
    [...slashCommands.values()]
      // ONLY GUILD COMMANDS
      .filter((command) => command!.guild !== false)
      .map((command: SlashCommand<any>) => {
        return {
          name: command.id,
          description: command!.description || 'No description available.',
          options: command!.options,
        }
      })
      .map((command) =>
        deployCommand({
          applicationId: getApplicationId(),
          command,
          botToken: config.discord.botToken,
          guildId: guildId,
        })
      )
  )

  const guildCommands = await getCommands({
    applicationId: getApplicationId(),
    botToken: config.discord.botToken,
    guildId,
  })
  console.log('guild commands', guildId, guildCommands)
}

// export async function cleanupCommands() {
//   const commands = await getSlashCommands()
//   for (const command of commands.values()) {
//     await deleteSlashCommand(command.id)
//   }
//   console.log('commands', commands)
// }

function getApplicationId() {
  const token = config.discord.botToken
  return decode(token?.split('.')[0] || '') || ''
}
