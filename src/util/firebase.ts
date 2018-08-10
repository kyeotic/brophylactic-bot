import admin from 'firebase-admin'
import config from '../config'

export const init = () => {
  if (!admin.apps.length) {
    let app = admin.initializeApp({
      credential: admin.credential.cert(config.firebase.cert),
      databaseURL: config.firebase.databaseUrl
    })
    let store = app.firestore()
    store.settings({ timestampsInSnapshots: true })
  }
  return admin.app()
}

export const initDb = () => {
  return init().firestore()
}
