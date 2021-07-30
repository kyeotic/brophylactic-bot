import { decode } from 'https://deno.land/std@0.82.0/encoding/base64.ts'
import { deepmerge } from './deps.ts'

const base64Decoder = new TextDecoder('utf-8')

function base64Decode(value: string) {
  return base64Decoder.decode(decode(value))
}

const firebase64 = Deno.env.get('FIREBASE_64')

if (!firebase64) {
  throw new Error('Firebase key is required')
}

const base = {
  discord: {
    botToken: Deno.env.get('BOT_TOKEN'),
    clientConfig: {
      intents: [
        'GUILDS',
        'GUILD_MEMBERS',
        'GUILD_MESSAGES',
        'GUILD_MESSAGE_REACTIONS',
        'DIRECT_MESSAGES',
      ],
    },
  },
  firebase: {
    databaseUrl: 'https://brophylactic-gaming.firebaseio.com',
    cert: JSON.parse(base64Decode(firebase64)),
  },
}

const test = {
  discord: {
    botToken: Deno.env.get('BOT_TOKEN_TEST'),
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

export default deepmerge(base, Deno.env.get('stage') === 'test' ? test : prod)
