import admin from 'firebase-admin'
import config from '../config'

export const init = () =>
  admin.initializeApp({
    credential: admin.credential.cert(config.firebase.cert),
    databaseURL: config.firebase.databaseUrl
  })

export const initDb = () => init().firestore()
