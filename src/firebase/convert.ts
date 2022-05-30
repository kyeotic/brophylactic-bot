// deno-lint-ignore-file no-explicit-any
import type { Document, Value, MapValue, ArrayValue } from './types.ts'

export function toDocument(obj: Record<string, any>): Pick<Document, 'fields'> {
  return {
    fields: Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, toValue(v) as Partial<Value>])
    ),
  }
}

export function toValue(
  value: string | null | undefined | number | Date | any[] | Record<string, any>
): Value | undefined {
  if (value === undefined) return undefined
  if (value === null) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (typeof value === 'number' && Math.abs(value) < Number.MAX_SAFE_INTEGER)
    return { integerValue: value.toString() }
  if (typeof value === 'number' && Math.abs(value) > Number.MAX_SAFE_INTEGER)
    return { doubleValue: value }
  if (Array.isArray(value))
    return { arrayValue: { values: value.map(toValue) as Partial<Value>[] } }
  if (value && typeof value === 'object')
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value)
            .map(([k, v]) => [k, toValue(v)])
            .filter(([, v]) => v !== undefined)
        ),
      },
    }
  throw new Error(`unable to parse type: ${typeof value}`)
}

export function fromValue(field: { nullValue: null }): null
export function fromValue(field: { booleanValue: boolean }): boolean
export function fromValue(field: { integerValue: string }): number
export function fromValue(field: { doubleValue: number }): number
export function fromValue(field: { timestampValue: string }): Date
export function fromValue(field: { stringValue: string }): string
export function fromValue(field: { arrayValue: ArrayValue }): any[]
export function fromValue(field: { mapValue: MapValue }): Record<string, any>
export function fromValue(
  field: Value
): null | undefined | string | number | boolean | Record<string, any> | any[]
export function fromValue(
  field: Value
): null | undefined | string | number | boolean | Record<string, any> | any[] {
  if (field.nullValue !== undefined) return null
  if (field.booleanValue !== undefined) return field.booleanValue ?? false
  if (field.integerValue !== undefined) return parseFloat(field.integerValue)
  if (field.doubleValue !== undefined) return Number(field.doubleValue)
  if (field.timestampValue !== undefined) return new Date(field.timestampValue)
  if (field.stringValue !== undefined) return field.stringValue
  if (field.arrayValue) return field.arrayValue.values.map(fromValue)
  if (field.mapValue) return fromDocument(field.mapValue.fields)
  return undefined
}

export function fromDocument<T extends Record<string, any>>(fields: MapValue['fields']): T {
  const result: Record<string, any> = {}
  for (const [prop, value] of Object.entries(fields)) {
    result[prop] = fromValue(value)
  }
  return result as T
}
