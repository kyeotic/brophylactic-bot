export function sum(nums: number[]): number {
  return nums.reduce((total, c) => total + c, 0)
}
