/* eslint-disable no-console */
import { TextEncoder } from 'node:util'
import nacl from 'tweetnacl'

export function verifyKey(
  body: Uint8Array | ArrayBuffer | Buffer | string,
  signature: Uint8Array | ArrayBuffer | Buffer | string,
  timestamp: Uint8Array | ArrayBuffer | Buffer | string,
  clientPublicKey: Uint8Array | ArrayBuffer | Buffer | string
): boolean {
  try {
    const timestampData = valueToUint8Array(timestamp)
    const bodyData = valueToUint8Array(body)
    const message = concatUint8Arrays(timestampData, bodyData)

    const signatureData = valueToUint8Array(signature, 'hex')
    const publicKeyData = valueToUint8Array(clientPublicKey, 'hex')
    return nacl.sign.detached.verify(message, signatureData, publicKeyData)
  } catch (ex) {
    console.error('[discord-interactions]: Invalid verifyKey parameters', ex)
    return false
  }
}

function valueToUint8Array(
  value: Uint8Array | ArrayBuffer | Buffer | string,
  format?: string
): Uint8Array {
  if (value == null) {
    return new Uint8Array()
  }
  if (typeof value === 'string') {
    if (format === 'hex') {
      const matches = value.match(/.{1,2}/g)
      if (matches == null) {
        throw new Error('Value is not a valid hex string')
      }
      const hexVal = matches.map((byte: string) => parseInt(byte, 16))
      return new Uint8Array(hexVal)
    } else {
      return new TextEncoder().encode(value)
    }
  }
  try {
    if (Buffer.isBuffer(value)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const arrayBuffer = value.buffer.slice(value.byteOffset, value.byteOffset + value.length)
      return new Uint8Array(value)
    }
  } catch (ex) {
    // Runtime doesn't have Buffer
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value)
  }
  if (value instanceof Uint8Array) {
    return value
  }
  throw new Error(
    'Unrecognized value type, must be one of: string, Buffer, ArrayBuffer, Uint8Array'
  )
}

function concatUint8Arrays(arr1: Uint8Array, arr2: Uint8Array): Uint8Array {
  const merged = new Uint8Array(arr1.length + arr2.length)
  merged.set(arr1)
  merged.set(arr2, arr1.length)
  return merged
}
