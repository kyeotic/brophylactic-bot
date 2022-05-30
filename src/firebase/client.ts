import { urlJoin } from '../deps.ts'
import type { FetchRequest } from './types.ts'

export class FirebaseClient {
  private host: string
  private projectId: string
  private token?: string
  private tokenFn: () => Promise<string>

  constructor({
    host,
    tokenFn,
    projectId,
  }: {
    host: string
    projectId: string
    tokenFn: () => Promise<string>
  }) {
    this.host = host
    this.projectId = projectId
    this.tokenFn = tokenFn
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
    return urlJoin(
      'projects',
      projectId || this.projectId,
      'databases',
      databaseId || '(default)',
      path
    )
  }

  public async getToken() {
    if (!this.token) {
      this.token = await this.tokenFn()
    }
    return this.token
  }

  async request<T>(params: FetchRequest): Promise<T | null> {
    const requestHeaders: HeadersInit = new Headers()

    requestHeaders.set('Content-Type', 'application/json')

    const token = params?.authorization ?? (await this.getToken())
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`)
    }

    const url =
      urlJoin(
        this.host,
        'v1',
        'projects',
        params.projectId || this.projectId,
        'databases',
        params.databaseId || '(default)',
        params.url
      ) + extractQuery(params)

    const req = await fetch(url, {
      method: params.method ?? 'POST',
      body: params?.body && JSON.stringify(params.body),
      headers: requestHeaders,
    })

    if (req.status === 404) {
      console.log('404', await req.json())
      return null
    }

    if (req.status > 399) {
      const { error } = (await req.json()) as { error: { message: string } }
      throw new Error(`Firebase Error ${req.status}: ${error.message}`)
    }

    return (await req.json()) as T
  }
}

function extractQuery({
  pageSize,
  pageToken,
  orderBy,
  mask,
  updateMask,
  showMissing,
}: Partial<FetchRequest>): string {
  const query = new URLSearchParams(
    removeEmpty({
      size: pageSize,
      page: pageToken,
      order: orderBy,
      missing: showMissing,
    }) as Record<string, string>
  )

  if (mask?.fieldPaths?.length) {
    mask.fieldPaths.forEach((p) => query.append('mask.fieldPaths', p))
  }
  if (updateMask?.fieldPaths?.length) {
    updateMask.fieldPaths.forEach((p) => query.append('updateMask.fieldPaths', p))
  }

  const querystring = query.toString()

  return querystring ? '?' + querystring : ''
}

function removeEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null))
}
