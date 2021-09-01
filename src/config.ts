import { decode } from 'https://deno.land/std@0.82.0/encoding/base64.ts'
import { deepmerge } from './deps.ts'

const base64Decoder = new TextDecoder('utf-8')

function base64Decode(value: string) {
  return base64Decoder.decode(decode(value))
}

const isLocal = Deno.env.get('IS_LOCAL') === 'true'
const firebase64 = Deno.env.get('FIREBASE_64')
const publicKey = isLocal
  ? Deno.env.get('DISCORD_PUBLIC_KEY_TEST')
  : Deno.env.get('DISCORD_PUBLIC_KEY')
const botToken = isLocal ? Deno.env.get('BOT_TOKEN_TEST') : Deno.env.get('BOT_TOKEN')

if (!firebase64) throw new Error('FIREBASE_64 is required')
if (!publicKey) throw new Error('DISCORD_PUBLIC_KEY is required')
if (!botToken) throw new Error('BOT_TOKEN is required')

const base = {
  port: 8006,
  isLocal,
  discord: {
    useGateway: true,
    apiHost: 'https://discord.com/api/v8',
    serverId: '',
    residentRoleId: '',
    newMemberRoleId: '',
    publicKey,
    botToken,
    intents: ['GUILDS', 'GUILD_MEMBERS'],
    botIntents: ['Guilds', 'GuildMembers'] as ['Guilds', 'GuildMembers'],
  },
  firebase: {
    host: 'https://firestore.googleapis.com',
    databaseUrl: 'https://brophylactic-gaming.firebaseio.com',
    projectId: 'brophylactic-gaming',
    cert: JSON.parse(base64Decode(firebase64)),
  },
}

const test = {
  discord: {
    serverId: '472286758030147585',
    residentRoleId: '472436078465253379',
    newMemberRoleId: '472436224066584576',
  },
}

const prod = {
  discord: {
    serverId: '124413689116884992',
    residentRoleId: '124414188930990081',
    newMemberRoleId: '472454665447931908',
  },
}

export default deepmerge(base, isLocal ? test : prod) as typeof base
