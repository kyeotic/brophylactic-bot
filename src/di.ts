import config from './config.ts'

import { FirebaseClient } from './firebase/client.ts'
import { Firestore } from './firebase/firestore.ts'
import { getToken } from './firebase/token.ts'
import { UserStore } from './users/store.ts'
import { LotteryStore } from './lottery/store.ts'
import { BrxLottery, BrxLotteryProps, NewLotteryProps } from './lottery/brxLottery.ts'
import { WorkflowClient } from './workflow/client.ts'

type BrxLotteryNoContext = Omit<BrxLotteryProps, 'context'>

export interface AppContext {
  config: typeof config
  firebaseClient: FirebaseClient
  firestore: Firestore
  userStore: UserStore
  lotteryStore: LotteryStore
  workflow: WorkflowClient
  lottery: {
    init: (props: BrxLotteryNoContext & NewLotteryProps) => ReturnType<typeof BrxLottery['init']>
    load: (id: string, props: BrxLotteryNoContext) => ReturnType<typeof BrxLottery['load']>
  }
}

export function initContext(init = {}): AppContext {
  const context = { ...init } as AppContext

  context.config = config
  context.firebaseClient = new FirebaseClient({
    host: config.firebase.host,
    projectId: config.firebase.projectId,
    tokenFn: () => getToken(config.firebase.cert),
  })

  context.firestore = new Firestore({ client: context.firebaseClient })
  context.userStore = new UserStore({ store: context.firestore })
  context.lotteryStore = new LotteryStore({ store: context.firestore })

  context.lottery = {
    init: (props: BrxLotteryNoContext & NewLotteryProps) => BrxLottery.init({ ...props, context }),
    load: (id: string, props: BrxLotteryNoContext) => BrxLottery.load(id, { ...props, context }),
  }

  context.workflow = new WorkflowClient({ config: config.workflow })

  return context
}
