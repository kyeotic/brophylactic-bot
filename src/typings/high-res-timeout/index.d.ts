/// <reference types="node" />

declare module 'high-res-timeout' {
  import { EventEmitter } from 'events'
  export default class Timeout extends EventEmitter {
    // tslint:disable-next-line:variable-name
    public _promise: Promise<{}>
    constructor(ms: number)
    public start(): Timeout
    public on(
      event: 'complete' | 'stop' | 'start' | 'reset' | 'tick',
      listener: (...args: any[]) => void
    ): this
    public duration: number
    public readonly progress: number
    public readonly running: boolean
  }
}
