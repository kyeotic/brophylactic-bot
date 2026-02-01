import { Firestore } from '../firebase/firestore'
import type { FirebaseClient } from '../firebase/client'
import type { AppLogger } from '../di'
import type { Job, JobHandler } from './types'

type JobDocument = Job & { id: string }

export class JobQueue {
  private readonly store: Firestore<JobDocument>
  private readonly logger: AppLogger
  private readonly handlers = new Map<string, JobHandler>()
  private intervalId: ReturnType<typeof setInterval> | null = null

  constructor({ client, logger }: { client: FirebaseClient; logger: AppLogger }) {
    this.store = new Firestore({ client, collection: 'jobs' })
    this.logger = logger
  }

  register(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler)
  }

  async enqueue(type: string, payload: unknown, delaySeconds: number): Promise<void> {
    const executeAt = new Date(Date.now() + delaySeconds * 1000).toISOString()
    const id = `${type}-${Date.now()}`
    await this.store.createDocument({
      id,
      type,
      payload,
      executeAt,
      status: 'pending',
    } as JobDocument)
    this.logger.info(`Job enqueued: ${type} (${id}), executeAt: ${executeAt}`)
  }

  start(pollIntervalMs = 5000): void {
    this.logger.info(`Job queue started, polling every ${pollIntervalMs}ms`)
    // Process immediately on startup for recovery
    this.processDueJobs()
    this.intervalId = setInterval(() => this.processDueJobs(), pollIntervalMs)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      this.logger.info('Job queue stopped')
    }
  }

  async processDueJobs(): Promise<void> {
    try {
      const jobs = await this.store.listDocuments()
      const now = new Date()

      for (const job of jobs) {
        if (job.status === 'pending' && new Date(job.executeAt) <= now) {
          await this.executeJob(job)
        }
      }
    } catch (err) {
      this.logger.error({ err }, 'Error processing jobs')
    }
  }

  private async executeJob(job: JobDocument): Promise<void> {
    const handler = this.handlers.get(job.type)
    if (!handler) {
      this.logger.error(`No handler registered for job type: ${job.type}`)
      return
    }

    try {
      await this.store.updateDocument(job.id, { status: 'running' } as Partial<JobDocument>)
      await handler(job.payload)
      await this.store.deleteDocument(job.id)
      this.logger.info(`Job completed: ${job.type} (${job.id})`)
    } catch (err) {
      this.logger.error({ err }, `Job failed: ${job.type} (${job.id})`)
      await this.store.updateDocument(job.id, { status: 'failed' } as Partial<JobDocument>)
    }
  }
}
