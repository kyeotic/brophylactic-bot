import config from './config'
import logger from './util/logger'

import { FirebaseClient } from './firebase/client'
import { getToken } from './firebase/token'
import { UserStore } from './users/store'
import { RouletteLotteryStore } from './roulette/store'
import { Roulette, RouletteProps, NewLotteryProps } from './roulette/roulette'
import { WorkflowClient } from './workflow/client'
import { DiscordClient } from './discord/api'

import type { LoggerWithSub as Logger } from 'lambda-logger-node'

type RouletteNoContext = Omit<RouletteProps, 'context'>
export type AppLogger = Logger

export interface AppContext {
  config: typeof config
  discord: DiscordClient
  firebaseClient: FirebaseClient
  userStore: UserStore
  rouletteStore: RouletteLotteryStore
  workflow: WorkflowClient
  roulette: {
    init: (props: RouletteNoContext & NewLotteryProps) => ReturnType<typeof Roulette['init']>
    load: (id: string, props: RouletteNoContext) => ReturnType<typeof Roulette['load']>
  }
  logger: AppLogger
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
  context.rouletteStore = new RouletteLotteryStore({ client: context.firebaseClient })

  context.roulette = {
    init: (props: RouletteNoContext & NewLotteryProps) => Roulette.init({ ...props, context }),
    load: (id: string, props: RouletteNoContext) => Roulette.load(id, { ...props, context }),
  }

  context.workflow = new WorkflowClient({ config: config.workflow, logger })

  return context
}
