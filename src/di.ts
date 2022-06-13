import config from './config.js'

import { FirebaseClient } from './firebase/client.js'
import { Firestore } from './firebase/firestore.js'
import { getToken } from './firebase/token.js'
import { UserStore } from './users/store.js'
import { LotteryStore } from './lottery/store.js'
import { BrxLottery, BrxLotteryProps, NewLotteryProps } from './lottery/brxLottery.js'
import { WorkflowClient } from './workflow/client.js'
import logger from './util/logger.js'

import type { LoggerWithSub as Logger } from 'lambda-logger-node'

type BrxLotteryNoContext = Omit<BrxLotteryProps, 'context'>
export type AppLogger = Logger

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
  logger: AppLogger
}

export function initContext(init = {}): AppContext {
  const context = { ...init } as AppContext

  context.config = config
  context.logger = logger

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

  context.workflow = new WorkflowClient({ config: config.workflow, logger })

  return context
}
