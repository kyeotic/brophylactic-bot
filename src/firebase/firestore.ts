import { fromDocument, toDocument } from './convert'
import type {
  BeginTransaction,
  CommitTransaction,
  MoveDocuments,
  RequestInterface,
  RollBack,
  Document,
  CommitResult,
  ConvertedDocument,
} from './types'
import type { FirebaseClient } from './client'

const COLLECTION_ERROR = 'Collection Required'
const ID_ERROR = 'ID Required'

// Docs: https://firebase.google.com/docs/firestore/reference/rest

export interface FireRequestOptions {
  transaction?: string
}

export class Firestore<T extends ConvertedDocument> {
  private readonly client: FirebaseClient
  private readonly collection: string

  constructor({ client, collection }: { client: FirebaseClient; collection: string }) {
    if (!collection) {
      throw new Error(COLLECTION_ERROR)
    }
    this.client = client
    this.collection = collection
  }

  asDocumentName({
    path,
    projectId,
    databaseId,
  }: {
    path: string
    projectId?: string
    databaseId?: string
  }): string {
    return this.client.asDocumentName({ path, projectId, databaseId })
  }

  async getDocument(id: string, options?: FireRequestOptions): Promise<T | null> {
    const doc = (await this.client.request({
      method: 'GET',
      url: id ? `documents/${this.collection}/${id}` : `documents/${this.collection}`,
      ...options,
    })) as Document

    if (!doc) return null

    return {
      ...fromDocument(doc.fields),
      id,
    } as T
  }

  async createDocument(item: T, options?: FireRequestOptions): Promise<T | null> {
    const doc = (await this.client.request({
      method: 'POST',
      url: `documents/${this.collection}?documentId=${item.id}`,
      body: toDocument(item as Record<string, any>),
      ...options,
    })) as Document

    if (!doc) return null

    return {
      ...fromDocument(doc.fields),
    } as T
  }

  // https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/patch
  async updateDocument<Props extends Partial<T>>(
    id: string,
    props: Props,
    options?: FireRequestOptions
  ): Promise<Props> {
    const { collection } = this
    validateRequest({ collection, id })

    const fieldMask = Object.getOwnPropertyNames(props)

    const doc = (await this.client.request({
      method: 'PATCH',
      url: `documents/${collection}/${id}`,
      body: toDocument(props),
      updateMask: {
        fieldPaths: fieldMask,
      },
      ...options,
    })) as Document

    return {
      ...fromDocument(doc.fields),
      id,
    } as Props
  }

  async deleteDocument(id: string, options?: FireRequestOptions): Promise<void> {
    const { collection } = this
    validateRequest({ collection, id })

    await this.client.request({
      method: 'DELETE',
      url: `documents/${collection}/${id}`,
      ...options,
    })
  }

  async beginTransaction({ options, ...props }: BeginTransaction): Promise<string> {
    const res = (await this.client.request({
      method: 'POST',
      url: `documents:beginTransaction`,
      body: {
        options,
      },
      ...props,
    })) as { transaction: string }

    return res.transaction
  }

  async commitTransaction({ writes, ...props }: CommitTransaction): Promise<CommitResult> {
    return (await this.client.request({
      method: 'POST',
      url: `documents:commit`,
      body: {
        writes,
      },
      ...props,
    })) as CommitResult
  }

  async moveDocuments({ collectionIds, outputUriPrefix, type, ...props }: MoveDocuments) {
    return await this.client.request({
      method: 'POST',
      url: `":${type ?? 'export'}Documents`,
      body: {
        collectionIds,
        outputUriPrefix,
      },
      ...props,
    })
  }

  async rollback({ transaction, ...props }: RollBack): Promise<string> {
    const res = (await this.client.request({
      method: 'POST',
      url: 'documents:rollback',
      body: {
        transaction,
      },
      ...props,
    })) as { transaction: string }

    return res.transaction
  }
}

function validateRequest({ collection, id }: Pick<RequestInterface, 'collection' | 'id'>) {
  if (!collection) {
    throw new Error(COLLECTION_ERROR)
  }
  if (!id) {
    throw new Error(ID_ERROR)
  }
}
