import config from './config'
import logger from './util/logger'

import { FirebaseClient } from './firebase/client'
import { getToken } from './firebase/token'
import { UserStore } from './users/store'
import { LotteryStore } from './lottery/store'
import { BrxLottery, BrxLotteryProps, NewLotteryProps } from './lottery/brxLottery'
import { WorkflowClient } from './workflow/client'
import { DiscordClient } from './discord/api'

import type { LoggerWithSub as Logger } from 'lambda-logger-node'

type BrxLotteryNoContext = Omit<BrxLotteryProps, 'context'>
export type AppLogger = Logger

export interface AppContext {
  config: typeof config
  discord: DiscordClient
  firebaseClient: FirebaseClient
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

  context.discord = new DiscordClient({ config: config.discord })

  context.firebaseClient = new FirebaseClient({
    logger,
    host: config.firebase.host,
    projectId: config.firebase.projectId,
    tokenFn: () => getToken(config.firebase.cert),
  })

  context.userStore = new UserStore({ client: context.firebaseClient })
  context.lotteryStore = new LotteryStore({ client: context.firebaseClient })

  context.lottery = {
    init: (props: BrxLotteryNoContext & NewLotteryProps) => BrxLottery.init({ ...props, context }),
    load: (id: string, props: BrxLotteryNoContext) => BrxLottery.load(id, { ...props, context }),
  }

  context.workflow = new WorkflowClient({ config: config.workflow, logger })

  return context
}
