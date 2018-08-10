import {
  CollectionReference,
  DocumentData,
  DocumentReference,
  SetOptions,
  Transaction,
  UpdateData
} from '@google-cloud/firestore'
import { GuildMember, Message } from 'discord.js'

const delimiter = '.'

export class ReputationStore {
  constructor(private collection: CollectionReference) {}

  public async getUserRep(
    member: GuildMember,
    transaction?: Transaction
  ): Promise<number> {
    let baseRep = calculateRepFromJoinedDate(member)
    let doc = await get(this.getUserDoc(member), transaction)
    return doc.exists ? parseFloat(doc.data().reputation) : baseRep
  }

  public async setUserRep(
    member: GuildMember,
    reputation: number,
    transaction?: Transaction
  ): Promise<number> {
    await set(
      this.getUserDoc(member),
      { reputation },
      { merge: true },
      transaction
    )
    return reputation
  }

  public async exchangeUserRep(
    sender: GuildMember,
    receiver: GuildMember,
    amount: number
  ): Promise<void> {
    if (!amount || Number.isNaN(amount) || !Number.isInteger || amount < 1) {
      return Promise.reject(
        `must provide a valid, positive, integer amount ${
          amount === undefined ? `, got ℞${amount}` : ''
        }`
      )
    }
    return this.collection.firestore.runTransaction(async transaction => {
      let [senderRep, receiverRep] = await Promise.all([
        this.getUserRep(sender, transaction),
        this.getUserRep(receiver, transaction)
      ])
      if (senderRep - amount < 0) {
        return Promise.reject(
          `${
            sender.displayName
          } only has ℞${senderRep}, unable to send ℞${amount}`
        )
      }
      await Promise.all([
        this.setUserRep(sender, senderRep - amount, transaction),
        this.setUserRep(receiver, receiverRep + amount, transaction)
      ])
    })
  }

  private getUserDoc(member: GuildMember): DocumentReference {
    return this.collection.doc(getId(member))
  }
}

function get(doc: DocumentReference, transaction?: Transaction) {
  return transaction ? transaction.get(doc) : doc.get()
}

function update(
  doc: DocumentReference,
  data: UpdateData,
  transaction?: Transaction
) {
  return transaction ? transaction.update(doc, data) : doc.update(data)
}

function set(
  doc: DocumentReference,
  data: DocumentData,
  options?: SetOptions,
  transaction?: Transaction
) {
  transaction ? transaction.set(doc, data, options) : doc.set(data, options)
}

const millisecondsInADay = 86400000

function getId(member: GuildMember) {
  return [member.guild.id, member.id].join(delimiter)
}

function calculateRepFromJoinedDate(member: GuildMember): number {
  return Math.floor(
    (Date.now() - member.joinedAt.getTime()) / millisecondsInADay
  )
}
