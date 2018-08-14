export function isPositiveInteger(num: number) {
  return num && !Number.isNaN && Number.isInteger(num) && num > 0
}
