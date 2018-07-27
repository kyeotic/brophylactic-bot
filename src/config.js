'use strict'

require('dotenv').config()
const merge = require('deepmerge')

const base = {
  discord: {
    botToken: process.env.BOT_TOKEN
  }
}

const test = {
  discord: {
    serverId: '472286758030147585',
    newMemberRoleId: '472436224066584576'
  }
}

const prod = {
  discord: {
    serverId: '124413689116884992',
    newMemberRoleId: '472454665447931908'
  }
}

// module.exports = merge(base, test)
module.exports = merge(base, process.env.stage === 'test' ? test : prod)
