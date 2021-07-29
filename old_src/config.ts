import merge from 'deepmerge'
import dotenv from 'dotenv'

dotenv.config()

const firebase64 = process.env.FIREBASE_64

if (!firebase64) {
  throw new Error('Firebase key is required')
}

const base = {
  discord: {
    botToken: process.env.BOT_TOKEN,
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
    cert: JSON.parse(Buffer.from(firebase64, 'base64').toString('utf8')),
  },
}

const test = {
  discord: {
    botToken: process.env.BOT_TOKEN_TEST,
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

export default merge(base, process.env.stage === 'test' ? test : prod)
