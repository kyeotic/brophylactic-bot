import config from './config.ts'

import { FirebaseClient } from './firebase/client.ts'
import { Firestore } from './firebase/firestore.ts'
import { getToken } from './firebase/token.ts'
import { UserStore } from './users/store.ts'

/*
  Deno doesn't currently handle dynamic imports well
  This pattern of lazy props is designed to reduce code-loading until needed
  Though that is not being utilized
*/

export interface AppContext {
  firebaseClient: FirebaseClient
  firestore: Firestore
  userStore: UserStore
}

export function initContext(init = {}): AppContext {
  const context = { ...init } as AppContext

  context.firebaseClient = new FirebaseClient({
    host: config.firebase.host,
    projectId: config.firebase.projectId,
    tokenFn: () => getToken(config.firebase.cert),
  })

  context.firestore = new Firestore({ client: context.firebaseClient })
  context.userStore = new UserStore({ store: context.firestore })

  return context
}
