import {
  CollectionReference,
  DocumentData,
  DocumentReference,
  SetOptions,
  Transaction,
  // UpdateData,
} from '@google-cloud/firestore'
import { GuildMember } from 'discord.js'
import { isPositiveInteger } from '../util/number'

const delimiter = '.'

export class ReputationStore {
  constructor(private collection: CollectionReference) {}

  public async getUserRep(member: GuildMember): Promise<number> {
    const baseRep = calculateRepFromJoinedDate(member)
    const offset = await this.getUserRepOffset(member)
    return baseRep + offset
  }

  public async addUserRep(member: GuildMember, amount: number): Promise<void> {
    if (!Number.isInteger(amount)) {
      return Promise.reject(
        `must provide a valid integer amount ${amount === undefined ? `, got ℞${amount}` : ''}`
      )
    }
    return this.collection.firestore.runTransaction(async (transaction) => {
      const memberRep = await this.getFullUserRep(member, transaction)

      if (memberRep.reputation + memberRep.reputationOffset - amount < 0) {
        return Promise.reject(
          `${member.displayName} only has ℞${memberRep}, unable to add ℞${amount}`
        )
      }

      await this.setUserRepOffset(member, memberRep.reputationOffset + amount, transaction)
    })
  }

  public async transferUserRep(
    sender: GuildMember,
    receiver: GuildMember,
    amount: number
  ): Promise<void> {
    if (!isPositiveInteger(amount)) {
      return Promise.reject(
        `must provide a valid, positive, integer amount ${
          amount === undefined ? `, got ℞${amount}` : ''
        }`
      )
    }
    return this.collection.firestore.runTransaction(async (transaction) => {
      const [senderRep, receiverRep] = await Promise.all([
        this.getFullUserRep(sender, transaction),
        this.getFullUserRep(receiver, transaction),
      ])
      if (senderRep.reputation + senderRep.reputationOffset - amount < 0) {
        return Promise.reject(
          `${sender.displayName} only has ℞${senderRep}, unable to send ℞${amount}`
        )
      }
      await Promise.all([
        this.setUserRepOffset(sender, senderRep.reputationOffset - amount, transaction),
        this.setUserRepOffset(receiver, receiverRep.reputationOffset + amount, transaction),
      ])
    })
  }

  public async transferUserReps(
    receiver: GuildMember,
    senders: GuildMember[],
    amountToSend: number
  ) {
    if (!isPositiveInteger(amountToSend)) {
      return Promise.reject(
        `must provide a valid integer amount ${
          amountToSend === undefined ? `, got ℞${amountToSend}` : ''
        }`
      )
    }
    return this.collection.firestore.runTransaction(async (transaction) => {
      const receiverRep = await this.getFullUserRep(receiver, transaction)
      const senderReps = await Promise.all(
        senders.map((s) => this.getFullUserRep(s, transaction).then((rep) => ({ rep, sender: s })))
      )
      await Promise.all([
        this.setUserRepOffset(
          receiver,
          receiverRep.reputationOffset + amountToSend * senders.length,
          transaction
        ),
        ...senderReps.map((s) =>
          this.setUserRepOffset(s.sender, s.rep.reputationOffset - amountToSend, transaction)
        ),
      ])
    })
  }

  private async getFullUserRep(
    member: GuildMember,
    transaction?: Transaction
  ): Promise<{ reputation: number; reputationOffset: number }> {
    const reputation = calculateRepFromJoinedDate(member)
    const reputationOffset = await this.getUserRepOffset(member, transaction)
    return { reputation, reputationOffset }
  }

  private async getUserRepOffset(member: GuildMember, transaction?: Transaction): Promise<number> {
    const doc = await get(this.getUserDoc(member), transaction)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return doc.exists ? parseFloat(doc.data()!.reputationOffset) : 0
  }

  private async setUserRepOffset(
    member: GuildMember,
    reputationOffset: number,
    transaction?: Transaction
  ) {
    return await set(
      this.getUserDoc(member),
      { reputationOffset, name: member.displayName },
      { merge: true },
      transaction
    )
  }

  public async getUserLastGuess(
    member: GuildMember,
    transaction?: Transaction
  ): Promise<Date | null> {
    const doc = await get(this.getUserDoc(member), transaction)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return doc.exists && doc.data()?.lastGuessDate ? new Date(doc.data()!.lastGuessDate) : null
  }

  public async setUserLastGuess(
    member: GuildMember,
    lastGuessDate: Date,
    transaction?: Transaction
  ): Promise<void> {
    return await set(
      this.getUserDoc(member),
      { lastGuessDate: lastGuessDate.getTime(), name: member.displayName },
      { merge: true },
      transaction
    )
  }

  private getUserDoc(member: GuildMember): DocumentReference {
    return this.collection.doc(getId(member))
  }
}

function get(doc: DocumentReference, transaction?: Transaction) {
  return transaction ? transaction.get(doc) : doc.get()
}

// function update(doc: DocumentReference, data: UpdateData, transaction?: Transaction) {
//   return transaction ? transaction.update(doc, data) : doc.update(data)
// }

function set(
  doc: DocumentReference,
  data: DocumentData,
  options?: SetOptions,
  transaction?: Transaction
) {
  // @ts-ignore
  transaction ? transaction.set(doc, data, options) : doc.set(data, options)
}

const millisecondsInADay = 86400000

function getId(member: GuildMember) {
  return [member.guild.id, member.id].join(delimiter)
}

function calculateRepFromJoinedDate(member: GuildMember): number {
  return Math.floor((Date.now() - (member.joinedAt || new Date()).getTime()) / millisecondsInADay)
}
