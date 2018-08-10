import { ReputationStore } from './reputation/store'
import { initDb } from './util/firebase'
import { getter } from './util/lazy'

export interface IAppContext {
  stores: {
    reputation: ReputationStore
    firebase: FirebaseFirestore.Firestore
  }
}

export const makeContext = (init = {}): IAppContext => {
  const context = Object.assign({}, init) as IAppContext
  context.stores = {} as IAppContext['stores']
  getter(context.stores, 'firebase', initDb)
  getter(
    context.stores,
    'reputation',
    () => new ReputationStore(context.stores.firebase.collection('users'))
  )
  return context
}
