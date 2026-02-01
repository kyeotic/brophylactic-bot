export interface Job<T = unknown> {
  id: string
  type: string
  payload: T
  executeAt: string
  status: 'pending' | 'running' | 'failed'
}

export type JobHandler = (payload: unknown) => Promise<void>
