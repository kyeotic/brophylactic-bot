import { initContext } from './di'
import { finishLottery } from './lottery/command'

import type { Context } from 'aws-lambda'
import type { Interaction } from './discord/types'

export async function handler(event: unknown, lambdaContext: Context): Promise<void> {
  const context = initContext(lambdaContext)
  context.logger.info('received event', JSON.stringify(event, null, 2))

  await finishLottery(event as unknown as { id: string; interaction: Interaction }, context)
}
