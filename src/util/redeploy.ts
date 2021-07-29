import { decode, json, rest, setApplicationId, upsertSlashCommands } from '../deps.ts'
import { commands } from '../commands/mod.ts'

export default async function redeploy(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!authorization || authorization !== Deno.env.get('REDEPLOY_AUTHORIZATION')) {
    return json({ error: 'Invalid authorization header.' }, { status: 401 })
  }

  await updateGlobalCommands()
  return json({ success: true })
}

export async function updateGlobalCommands() {
  const token = Deno.env.get('DISCORD_TOKEN')
  rest.token = `Bot ${token}`
  setApplicationId(new TextDecoder().decode(decode(token?.split('.')[0] || '')) || '')

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
}