import admin from 'firebase-admin'
import config from '../config'

export const init = () => {
  if (!admin.apps.length) {
    const app = admin.initializeApp({
      credential: admin.credential.cert(config.firebase.cert),
      databaseURL: config.firebase.databaseUrl,
    })
    const store = app.firestore()
    store.settings({ timestampsInSnapshots: true })
  }
  return admin.app()
}

export const initDb = () => {
  return init().firestore()
}
