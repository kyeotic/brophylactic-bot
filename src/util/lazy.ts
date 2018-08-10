export const value = <T>(initFn: () => T) => {
  let val: T
  let isInitialized = false
  return () => {
    if (!isInitialized) val = initFn()
    return val
  }
}

export const getter = <T>(obj: object, property: string, initFn: () => T) => {
  Object.defineProperty(obj, property, {
    get: value(initFn)
  })
  return obj
}
