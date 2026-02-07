export const value = <T>(initFn: () => T) => {
  let val: T
  const isInitialized = false
  return () => {
    if (!isInitialized) val = initFn()
    return val
  }
}

export const getter = <T>(obj: Record<string, unknown>, property: string, initFn: () => T) => {
  Object.defineProperty(obj, property, {
    get: value(initFn),
  })
  return obj
}
