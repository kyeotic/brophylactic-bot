import { toValue, toDocument } from '../firebase/convert'
import { Firestore } from '../firebase/firestore'

import type { FirebaseClient } from '../firebase/client'
import type { Write } from '../firebase/types'
import type { GuildMember } from '../discord/types'
import { bgrLabel } from '../discord/api'

const delimiter = '.'
const COLLECTION = 'users'

export interface User {
  id: string
  name: string
  lastGuessDate?: Date
  lastSardinesDate?: Date
  reputationOffset: number
}

export class UserStore {
  private store: Firestore<User>
  constructor({ client }: { client: FirebaseClient }) {
    this.store = new Firestore({ client, collection: COLLECTION })
  }

  public async getUser(member: GuildMember, transaction?: string): Promise<User> {
    let user = await this.store.getDocument(getId(member), {
      transaction,
    })

    if (!user || user.name === undefined || user.reputationOffset === undefined) {
      user = await this.initUser(member, user ?? {})
    }

    return user
  }

  private async initUser(member: GuildMember, user?: Partial<User>): Promise<User> {
    const transaction = await this.store.beginTransaction({ options: { readWrite: {} } })
    const writes: Write[] = []

    if (user?.name === undefined) {
      writes.push({
        updateMask: { fieldPaths: ['name'] },
        update: {
          name: this.store.asDocumentName(getDocumentName(member)),
          ...toDocument({ name: member.username }),
        },
      })
    }

    if (user?.reputationOffset === undefined) {
      writes.push({
        updateMask: { fieldPaths: ['reputationOffset'] },
        update: {
          name: this.store.asDocumentName(getDocumentName(member)),
          ...toDocument({ reputationOffset: 0 }),
        },
      })
    }

    await this.store.commitTransaction({ transaction, writes })
    return (await this.store.getDocument(getId(member)))!
  }

  public async getUserRep(member: GuildMember): Promise<number> {
    const baseRep = calculateRepFromJoinedDate(member)
    const offset = await this.getUserRepOffset(member)
    return baseRep + offset
  }

  private async getUserRepOffset(member: GuildMember, transaction?: string): Promise<number> {
    const user = await this.getUser(member, transaction)

    if (!user) return 0

    const offset = user.reputationOffset ?? 0

    if (Number.isNaN(offset)) {
      await this.incrementUserRep(member, 0)
      return 0
    }

    return offset
  }

  public async incrementUserRep(member: GuildMember, offset: number): Promise<void> {
    return await this.incrementUserReps({ member, offset })
  }

  public async incrementUserReps(
    ...updates: { member: GuildMember; offset: number }[]
  ): Promise<void> {
    const writes = updates
      .map(({ member, offset }) => {
        if (!Number.isInteger(offset)) {
          throw new Error(
            `must provide a valid integer offset ${
              offset === undefined ? `, got ${bgrLabel(offset)}` : ''
            }`
          )
        }
        return [
          {
            transform: {
              document: this.store.asDocumentName(getDocumentName(member)),
              fieldTransforms: [
                {
                  fieldPath: 'reputationOffset',
                  increment: toValue(offset),
                },
              ],
            },
          },
          {
            updateMask: { fieldPaths: ['name'] },
            update: {
              name: this.store.asDocumentName(getDocumentName(member)),
              ...toDocument({ name: member.username }),
            },
          },
        ]
      })
      .flat()

    const transaction = await this.store.beginTransaction({ options: { readWrite: {} } })
    await this.store.commitTransaction({ transaction, writes })
  }

  public async getUserLastGuess(member: GuildMember): Promise<Date | null> {
    const user = await this.getUser(member)
    return user?.lastGuessDate ? user.lastGuessDate : null
  }

  public async setUserLastGuess(member: GuildMember, lastGuessDate: Date): Promise<void> {
    await this.store.updateDocument(getId(member), { lastGuessDate, name: member.username })
  }

  public async getUserLastSardines(member: GuildMember): Promise<Date | null> {
    const user = await this.getUser(member)
    return user?.lastSardinesDate ? user.lastSardinesDate : null
  }

  public async setUserLastSardines(member: GuildMember, lastSardinesDate: Date): Promise<void> {
    await this.store.updateDocument(getId(member), { lastSardinesDate, name: member.username })
  }
}

const millisecondsInADay = 86400000

function getDocumentName(member: GuildMember): { path: string } {
  return { path: 'documents/users/' + getId(member) }
}

function getId(member: GuildMember) {
  return [member.guildId, member.id].join(delimiter)
}

function calculateRepFromJoinedDate(member: GuildMember): number {
  return Math.floor((Date.now() - new Date(member.joinedAt).getTime()) / millisecondsInADay)
}
