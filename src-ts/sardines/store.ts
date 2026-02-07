import { Firestore } from '../firebase/firestore'
import { SardinesLottery } from './lottery'

import type { GuildMember } from '../discord/types'
import type { DbSardinesLottery } from './types'
import type { FirebaseClient } from '../firebase/client'

// Docs: https://firebase.google.com/docs/firestore/reference/rest

const COLLECTION = 'lotteries'

export class SardinesLotteryStore {
  private store: Firestore<DbSardinesLottery>

  constructor({ client }: { client: FirebaseClient }) {
    this.store = new Firestore({ client, collection: COLLECTION })
  }

  public async get(id: string, transaction?: string): Promise<SardinesLottery | null> {
    const dbLottery = await this.store.getDocument(id, { transaction })

    return dbLottery && new SardinesLottery(dbLottery)
  }

  public async put(lottery: SardinesLottery): Promise<SardinesLottery | null> {
    await this.store.createDocument(lottery.toJSON() as DbSardinesLottery)

    return lottery
  }

  public async delete(id: string): Promise<void> {
    return await this.store.deleteDocument(id)
  }

  public async setPlayers(id: string, players: GuildMember[]): Promise<void> {
    await this.store.updateDocument(id, { players })
  }

  public async setWinner(id: string, winner: GuildMember): Promise<void> {
    await this.store.updateDocument(id, { winner })
  }
}
