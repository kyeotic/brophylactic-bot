import { LambdaContext as Context } from './deps.ts'
import { initContext } from './di.ts'
import { finishLottery } from './lottery/command.ts'

import type { Interaction } from './deps.ts'

export async function handler(event: unknown, lambdaContext: Context): Promise<void> {
  console.log('received event', JSON.stringify(event, null, 2))
  const context = initContext(lambdaContext)

  await finishLottery(event as unknown as { id: string; interaction: Interaction }, context)
}
