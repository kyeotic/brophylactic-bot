/// <reference types="node" />

declare module 'shell-quote' {
  export function parse(command: string): Array<string | Record<string, unknown>>
}
