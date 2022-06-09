import { fromDocument, toValue, toDocument } from './convert'
import type {
  BeginTransaction,
  CommitTransaction,
  CreateDocument,
  DeleteDocument,
  MoveDocuments,
  GetDocument,
  RequestInterface,
  RollBack,
  UpdateDocument,
  Document,
  CommitResult,
  ConvertedDocument,
} from './types'
import type { FirebaseClient } from './client'

const COLLECTION_ERROR = 'Collection Required'
const ID_ERROR = 'ID Required'

// Docs: https://firebase.google.com/docs/firestore/reference/rest

export class Firestore {
  private client: FirebaseClient

  constructor({ client }: { client: FirebaseClient }) {
    this.client = client
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

  async getDocument<T extends ConvertedDocument>({
    collection,
    id,
    ...props
  }: GetDocument): Promise<T | null> {
    if (!collection) {
      throw new Error(COLLECTION_ERROR)
    }
    const doc = (await this.client.request({
      method: 'GET',
      url: id ? `documents/${collection}/${id}` : `documents/${collection}`,
      ...props,
    })) as Document

    if (!doc) return null

    return {
      ...fromDocument(doc.fields),
      id,
    } as T
  }

  async createDocument<T>({ collection, id, body, ...props }: CreateDocument): Promise<T | null> {
    if (!collection) {
      throw new Error(COLLECTION_ERROR)
    }
    const doc = (await this.client.request({
      method: 'POST',
      url: `documents/${collection}${id ? `?documentId=${id}` : ''}`,
      // deno-lint-ignore no-explicit-any
      body: toDocument(body as Record<string, any>),
      ...props,
    })) as Document

    if (!doc) return null

    return {
      ...fromDocument(doc.fields),
    } as T
  }

  // https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/patch
  async updateDocument<T extends ConvertedDocument>({
    collection,
    id,
    body,
    ...props
  }: UpdateDocument): Promise<T> {
    validateRequest({ collection, id })

    const doc = (await this.client.request({
      method: 'PATCH',
      url: `documents/${collection}/${id}`,
      body: toDocument(body!),
      ...props,
    })) as Document

    return {
      ...fromDocument(doc.fields),
      id,
    } as T
  }

  async deleteDocument({ collection, id, ...props }: DeleteDocument): Promise<void> {
    validateRequest({ collection, id })

    await this.client.request({
      method: 'DELETE',
      url: `documents/${collection}/${id}`,
      ...props,
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
