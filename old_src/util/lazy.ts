export const value = <T>(initFn: () => T) => {
  let val: T
  const isInitialized = false
  return () => {
    if (!isInitialized) val = initFn()
    return val
  }
}

export function getter<T, C>(obj: C, property: keyof C, initFn: () => T) {
  Object.defineProperty(obj, property, {
    get: value(initFn),
  })
  return obj
}
