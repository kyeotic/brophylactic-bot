/* eslint-disable no-console */
import urlJoin from 'url-join'
import request from 'request-micro'
import type { FetchRequest, HeadersInit } from './types.js'
import type { AppLogger } from '../di.js'

export class FirebaseClient {
  private readonly host: string
  private readonly projectId: string
  private token?: string
  private tokenExpiresAt = 0
  private readonly tokenFn: () => Promise<string>
  private readonly logger: AppLogger

  constructor({
    host,
    tokenFn,
    projectId,
    logger,
  }: {
    host: string
    projectId: string
    tokenFn: () => Promise<string>
    logger: AppLogger
  }) {
    this.host = host
    this.projectId = projectId
    this.tokenFn = tokenFn
    this.logger = logger
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
    if (!this.token || Date.now() >= this.tokenExpiresAt) {
      this.token = await this.tokenFn()
      // Token expires in 1 hour; refresh 5 minutes early
      this.tokenExpiresAt = Date.now() + 55 * 60 * 1000
    }
    return this.token
  }

  async request<T>(params: FetchRequest): Promise<T | null> {
    const requestHeaders: HeadersInit = {}

    requestHeaders['Content-Type'] = 'application/json'

    const token = params?.authorization ?? (await this.getToken())
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`
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

    const req = await request({
      url,
      method: params.method ?? 'POST',
      body: params.body,
      headers: requestHeaders,
      json: true,
    })

    if (req.statusCode === 404) {
      console.log('404', req.data)
      return null
    }

    if ((req.statusCode ?? 0) > 399) {
      const { error } = req.data as { error: { message: string } }
      this.logger.error({ statusCode: req.statusCode, data: req.data }, 'Firebase Error')
      throw new Error(`Firebase Error ${req.statusCode}: ${error.message}`)
    }

    return req.data as T
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
