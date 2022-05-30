import {
  rest,
  setApplicationId,
  upsertSlashCommands,
  getSlashCommands,
  deleteSlashCommand,
} from '../deps.ts'
import { decode } from '../deps.ts'
import { commands } from './interactions.ts'
import config from '../config.ts'

export async function redeploy() {
  configureRest()

  // await cleanupCommands()
  await updateGlobalCommands()
  if (config.discord.serverId) {
    await updateGuildCommands(config.discord.serverId)
  }
  return
}

function configureRest() {
  const token = config.discord.botToken
  rest.token = `Bot ${token}`
  setApplicationId(new TextDecoder().decode(decode(token?.split('.')[0] || '')) || '')
  console.log('applicationId', new TextDecoder().decode(decode(token?.split('.')[0] || '')) || '')
}

export async function updateGlobalCommands() {
  configureRest()

  // UPDATE GLOBAL COMMANDS
  await upsertSlashCommands(
    Object.entries(commands)
      // ONLY GLOBAL COMMANDS
      .filter(([, command]) => command?.global)
      .map(([name, command]) => {
        return {
          name,
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
  )
  const appCommmands = await getSlashCommands()
  console.log('app commands', appCommmands)
}

export async function updateGuildCommands(guildId: string) {
  // GUILD RELATED COMMANDS
  await upsertSlashCommands(
    Object.entries(commands)
      // ONLY GUILD COMMANDS
      .filter(([, command]) => command!.guild !== false)
      .map(([name, command]) => {
        return {
          name,
          description: command!.description || 'No description available.',
          options: command!.options,
        }
      }),
    BigInt(guildId)
  )
  const guildCommands = await getSlashCommands(BigInt(guildId))
  console.log('guild commands', guildId, guildCommands)
}

export async function cleanupCommands() {
  const commands = await getSlashCommands()
  for (const command of commands.values()) {
    await deleteSlashCommand(command.id)
  }
  console.log('commands', commands)
}
