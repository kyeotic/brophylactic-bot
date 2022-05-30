import type { Firestore } from '../firebase/firestore.ts'

import type { GuildMember } from '../discord/types.ts'
import type { DbLottery } from './types.ts'
import { Lottery } from './lottery.ts'

// Docs: https://firebase.google.com/docs/firestore/reference/rest

const collection = 'lotteries'

export type GuildLottery = Lottery<GuildMember>

export class LotteryStore {
  private store: Firestore
  constructor({ store }: { store: Firestore }) {
    this.store = store
  }

  public async get(id: string, transaction?: string): Promise<GuildLottery | null> {
    const dbLottery = await this.store.getDocument<DbLottery>({
      collection,
      id,
      transaction,
    })

    return dbLottery && new Lottery(dbLottery)
  }

  public async put(lottery: GuildLottery): Promise<GuildLottery | null> {
    await this.store.createDocument<DbLottery>({
      collection,
      id: lottery.id,
      body: lottery.toJSON(),
    })

    return lottery
  }

  public async delete(id: string): Promise<void> {
    return await this.store.deleteDocument({
      collection,
      id,
    })
  }

  public async setPlayers(id: string, players: GuildMember[]): Promise<void> {
    await this.store.updateDocument({
      collection,
      id,
      body: { players },
      updateMask: {
        fieldPaths: ['players'],
      },
    })
  }

  public async setWinner(id: string, winner: GuildMember): Promise<void> {
    await this.store.updateDocument({
      collection,
      id: id,
      body: { winner },
      updateMask: {
        fieldPaths: ['winner'],
      },
    })
  }
}
