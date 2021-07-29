export function isPositiveInteger(num: number) {
  return num && !Number.isNaN(num) && Number.isInteger(num) && num > 0
}
