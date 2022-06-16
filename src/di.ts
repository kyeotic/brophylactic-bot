import config from './config'
import logger from './util/logger'

import { FirebaseClient } from './firebase/client'
import { getToken } from './firebase/token'
import { UserStore } from './users/store'
import { RouletteLotteryStore } from './roulette/store'
import { Roulette, RouletteProps, NewLotteryProps } from './roulette/roulette'
import { SardinesLotteryStore } from './sardines/store'
import { Sardines, SardinesProps } from './sardines/sardines'
import { WorkflowClient } from './workflow/client'
import { DiscordClient } from './discord/api'

import type { LoggerWithSub as Logger } from 'lambda-logger-node'

type NoContext<T> = Omit<T, 'context'>
export type AppLogger = Logger

export interface AppContext {
  config: typeof config
  logger: AppLogger
  discord: DiscordClient
  firebaseClient: FirebaseClient
  userStore: UserStore
  rouletteStore: RouletteLotteryStore
  roulette: {
    init: (props: NoContext<RouletteProps> & NewLotteryProps) => ReturnType<typeof Roulette['init']>
    load: (id: string, props: NoContext<RouletteProps>) => ReturnType<typeof Roulette['load']>
  }
  sardinesStore: SardinesLotteryStore
  sardines: {
    init: (props: NoContext<SardinesProps> & NewLotteryProps) => ReturnType<typeof Sardines['init']>
    load: (id: string, props: NoContext<SardinesProps>) => ReturnType<typeof Sardines['load']>
  }
  workflow: WorkflowClient
}

export function initContext(init = {}): AppContext {
  const context = { ...init } as AppContext

  context.config = config
  context.logger = logger

  context.discord = new DiscordClient({ config: config.discord, logger })

  context.firebaseClient = new FirebaseClient({
    logger,
    host: config.firebase.host,
    projectId: config.firebase.projectId,
    tokenFn: () => getToken(config.firebase.cert),
  })

  context.userStore = new UserStore({ client: context.firebaseClient })

  // Roulette
  context.rouletteStore = new RouletteLotteryStore({ client: context.firebaseClient })
  context.roulette = {
    init: (props: NoContext<RouletteProps> & NewLotteryProps) =>
      Roulette.init({ ...props, context }),
    load: (id: string, props: NoContext<RouletteProps>) => Roulette.load(id, { ...props, context }),
  }

  // Sardines
  context.sardinesStore = new SardinesLotteryStore({ client: context.firebaseClient })
  context.sardines = {
    init: (props: NoContext<SardinesProps> & NewLotteryProps) =>
      Sardines.init({ ...props, context }),
    load: (id: string, props: NoContext<SardinesProps>) => Sardines.load(id, { ...props, context }),
  }

  context.workflow = new WorkflowClient({ config: config.workflow, logger })

  return context
}
