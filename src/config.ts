import base64 from 'base64url'

const stage = process.env.stage || 'dev'

const requiredEnvs = {
  firebase64: 'FIREBASE_64',
  publicKey: 'DISCORD_PUBLIC_KEY',
  botToken: 'BOT_TOKEN',
  serverId: 'DISCORD_SERVER_ID',
} as const

const envs = Object.fromEntries(
  Object.entries(requiredEnvs).map(([key, e]) => {
    const val = process.env[e]
    if (!val) throw new Error(`ENV VAR ${e} is required`)
    return [key, val] as [keyof typeof requiredEnvs, string]
  })
) as { [name in keyof typeof requiredEnvs]: string }

const config = {
  port: 8006,
  stage,
  discord: {
    timezone: 'America/Los_Angeles',
    useGateway: true,
    apiHost: 'https://discord.com/api/v10',
    userAgent: 'DiscordBot (https://github.com/kyeotic/brophylactic-bot, v1)',
    serverId: envs.serverId,
    publicKey: envs.publicKey,
    botToken: envs.botToken,
    intents: ['GUILDS', 'GUILD_MEMBERS'],
    botIntents: ['Guilds', 'GuildMembers'] as ['Guilds', 'GuildMembers'],
  },
  firebase: {
    host: 'https://firestore.googleapis.com',
    databaseUrl: 'https://brophylactic-gaming.firebaseio.com',
    projectId: 'brophylactic-gaming',
    cert: JSON.parse(base64.decode(envs.firebase64)),
  },
} as const

export default config
