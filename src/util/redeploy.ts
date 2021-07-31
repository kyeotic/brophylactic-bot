import {
  decode,
  json,
  rest,
  setApplicationId,
  upsertSlashCommands,
  getSlashCommands,
  deleteSlashCommand,
} from '../deps.ts'
import { commands } from '../commands/mod.ts'
import config from '../config.ts'

export default async function redeploy(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!authorization || authorization !== config.discord.redeployAuthorization) {
    return json({ error: 'Invalid authorization header.' }, { status: 401 })
  }

  configureRest()

  // await cleanupCommands()
  await updateGlobalCommands()
  if (config.discord.serverId) {
    await updateGuildCommands(config.discord.serverId)
  }
  return json({ success: true })
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
      .filter(([_name, command]) => command?.global)
      .map(([name, command]) => {
        const description = `${name.toUpperCase()}_DESCRIPTION`

        return {
          name,
          description: command!.description || description || 'No description available.',
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
      .filter(([_name, command]) => command!.guild !== false)
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
