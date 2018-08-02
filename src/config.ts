import merge from 'deepmerge'
import dotenv from 'dotenv'

dotenv.config()

const base = {
  discord: {
    botToken: process.env.BOT_TOKEN
  },
  firebase: {
    databaseUrl: 'https://brophylactic-gaming.firebaseio.com',
    cert: JSON.parse(
      Buffer.from(process.env.FIREBASE_64, 'base64').toString('utf8')
    )
  }
}

const test = {
  discord: {
    serverId: '472286758030147585',
    residentRoleId: '472436078465253379',
    newMemberRoleId: '472436224066584576'
  }
}

const prod = {
  discord: {
    serverId: '124413689116884992',
    residentRoleId: '124414188930990081',
    newMemberRoleId: '472454665447931908'
  }
}

export default merge(base, process.env.stage === 'test' ? test : prod)
