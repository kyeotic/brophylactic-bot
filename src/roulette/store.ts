import { Firestore } from '../firebase/firestore'
import type { FirebaseClient } from '../firebase/client'

import type { GuildMember } from '../discord/types'
import type { DbRouletteLottery } from './types'
import { Lottery } from '../games/lottery'

// Docs: https://firebase.google.com/docs/firestore/reference/rest

const COLLECTION = 'lotteries'

export type RouletteLottery = Lottery<GuildMember>

export class RouletteLotteryStore {
  private store: Firestore<DbRouletteLottery>

  constructor({ client }: { client: FirebaseClient }) {
    this.store = new Firestore({ client, collection: COLLECTION })
  }

  public async get(id: string, transaction?: string): Promise<RouletteLottery | null> {
    const dbLottery = await this.store.getDocument(id, { transaction })

    return dbLottery && new Lottery(dbLottery)
  }

  public async put(lottery: RouletteLottery): Promise<RouletteLottery | null> {
    await this.store.createDocument(lottery.toJSON() as DbRouletteLottery)

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
