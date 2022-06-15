/* eslint-disable @typescript-eslint/no-non-null-assertion */
import base64Url from 'base64url'
import { slashCommands } from './interactions'
import config from '../config'
import { SlashCommand } from './types'
import { initContext } from '../di'
import type { DiscordClient } from './api'

const { decode } = base64Url

export async function redeploy() {
  const { discord } = initContext()
  // await cleanupCommands()
  await updateGlobalCommands(discord)
  if (config.discord.serverId) {
    await updateGuildCommands(discord, config.discord.serverId)
  }
  return
}

export async function updateGlobalCommands(discord: DiscordClient) {
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
        discord.deployCommand({
          applicationId: getApplicationId(),
          command,
        })
      )
  )

  const appCommmands = await discord.getCommands({
    applicationId: getApplicationId(),
  })
  console.log('app commands', appCommmands)
}

export async function updateGuildCommands(discord: DiscordClient, guildId: string) {
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
        discord.deployCommand({
          applicationId: getApplicationId(),
          command,
          guildId: guildId,
        })
      )
  )

  const guildCommands = await discord.getCommands({
    applicationId: getApplicationId(),
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
