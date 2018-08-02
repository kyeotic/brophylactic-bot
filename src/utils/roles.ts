import { Guild, GuildMember, Message, Role } from 'discord.js'
import R from 'ramda'

const userRolesFilter = R.filter(
  (r: Role) => r.name !== '@everyone' && !r.managed
)

export function hasRole(member: GuildMember, role: Role) {
  return member.roles.has(role.id)
}

/**
 * Check if a user has the intro role for a server
 *
 * @param {GuildMember} member
 * @returns {boolean}
 */
export function hasIntroRole(member: GuildMember): boolean {
  return member.roles.has(getIntroRole(member.guild).id)
}

/**
 * Return the lowest non-managed, non @everyone role for the server
 *
 * @param {Guild} guild
 * @returns {Role}
 */
export function getIntroRole(guild: Guild): Role {
  return R.pipe(
    userRolesFilter,
    R.reduce(R.minBy((r: Role) => r.calculatedPosition), {
      calculatedPosition: Infinity
    } as Role)
  )(Array.from(guild.roles.values()))
}

/**
 * Check if a member is has a non-intro role (they are a "known member" of the server)
 *
 * @param {GuildMember} member
 * @returns {boolean}
 */
export function isResident(member: GuildMember): boolean {
  return (
    R.length(userRolesFilter(member.roles.array())) && !hasIntroRole(member)
  )
}

export function getResidentRole(guild: Guild): Role {
  return R.pipe(
    userRolesFilter,
    R.reject(R.equals(getIntroRole(guild))),
    R.reduce(R.minBy((r: Role) => r.calculatedPosition), {
      calculatedPosition: Infinity
    } as Role)
  )(Array.from(guild.roles.values()))
}
