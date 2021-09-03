// deno-lint-ignore-file require-await
import type { BrxLottery } from './brxLottery.ts'

export class BrxLotteryCache {
  // Poor mans cache
  private readonly lotteries: Map<string, BrxLottery>
  constructor() {
    this.lotteries = new Map<string, BrxLottery>()
  }

  // everything is async so that when we switch to a real cache the API doesn't change

  async get(id: string): Promise<BrxLottery | undefined> {
    return this.lotteries.get(id)
  }

  async set(id: string, lottery: BrxLottery): Promise<void> {
    this.lotteries.set(id, lottery)
    return
  }

  async delete(id: string): Promise<void> {
    this.lotteries.delete(id)
    return
  }
}
