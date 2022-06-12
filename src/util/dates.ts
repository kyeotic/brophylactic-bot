export {
  format as formatDate,
  isSameDay,
  startOfDay,
  formatDistanceToNow,
  differenceInSeconds,
} from 'date-fns'
export { zonedTimeToUtc, utcToZonedTime, format as formatWithTimezone } from 'date-fns-tz'

export function humanizeMilliseconds(milliseconds: number) {
  if (milliseconds < 1000) return `${milliseconds}ms`

  // Gets ms into seconds
  const time = milliseconds / 1000
  const days = Math.floor(time / 86400)
  const hours = Math.floor((time % 86400) / 3600)
  const minutes = Math.floor(((time % 86400) % 3600) / 60)
  const seconds = Math.floor(((time % 86400) % 3600) % 60)

  const dayString = days ? `${days}d ` : ''
  const hourString = hours ? `${hours}h ` : ''
  const minuteString = minutes ? `${minutes}m ` : ''
  const secondString = seconds ? `${seconds}s ` : ''

  return `${dayString}${hourString}${minuteString}${secondString}`
}
