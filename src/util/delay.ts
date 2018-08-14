const createDelay = (willResolve: boolean) => (ms: number, value?: any) => {
  let timeoutId: NodeJS.Timer
  let settle: (value?: {} | PromiseLike<{}>) => void

  const delayPromise = new Promise((resolve, reject) => {
    settle = willResolve ? resolve : reject
    timeoutId = setTimeout(settle, ms, value)
  }) as IClearablePromise<{}>

  delayPromise.clear = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
      settle(value)
    }
  }

  return delayPromise
}

interface IClearablePromise<T> extends Promise<T> {
  clear: () => void
}

export const delay = createDelay(true)
export const delayReject = createDelay(false)
