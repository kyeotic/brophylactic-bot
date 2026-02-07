export function times<T>(count: number, fn: () => T): T[] {
  const results: T[] = []
  while (count--) {
    results.push(fn())
  }
  return results
}
