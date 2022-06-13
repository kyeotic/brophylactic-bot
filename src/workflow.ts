import { LambdaContext as Context } from './deps.js'
import { initContext } from './di.js'
import { finishLottery } from './lottery/command.js'

import type { Interaction } from 'discord.js'

export async function handler(event: unknown, lambdaContext: Context): Promise<void> {
  const context = initContext(lambdaContext)
  context.logger.info('received event', JSON.stringify(event, null, 2))

  await finishLottery(event as unknown as { id: string; interaction: Interaction }, context)
}
