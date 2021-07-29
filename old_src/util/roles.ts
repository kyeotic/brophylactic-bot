import { Guild, GuildMember, Role } from 'discord.js'
import _ from 'lodash'

export const ROLES = {
  RESIDENT: 'Resident',
  INTERN: 'Intern',
}

export function hasRole(member: GuildMember, role: Role) {
  return member.roles.cache.has(role.id)
}

/**
 * Check if a user has the intro role for a server
 *
 * @param {GuildMember} member
 * @returns {boolean}
 */
export function hasIntroRole(member: GuildMember): boolean {
  return member.roles.cache.has(getIntroRole(member.guild).id)
}

/**
 * Return the lowest non-managed, non @everyone role for the server
 *
 * @param {Guild} guild
 * @returns {Role}
 */
export function getIntroRole(guild: Guild): Role {
  return (
    findRoleByName(guild, ROLES.INTERN) ??
    minCalculatedRole(Array.from(guild.roles.cache.values()).filter(userRoleFilter))
  )
}

/**
 * Check if a member is has a non-intro role (they are a "known member" of the server)
 *
 * @param {GuildMember} member
 * @returns {boolean}
 */
export function isResident(member: GuildMember): boolean {
  const role = getResidentRole(member.guild)
  if (!role) return false
  return member.roles.cache.has(role.id)

  return !!member.roles.cache.array().filter(userRoleFilter).length && !hasIntroRole(member)
}

export function getResidentRole(guild: Guild): Role {
  const introRole = getIntroRole(guild)
  return (
    findRoleByName(guild, ROLES.RESIDENT) ??
    minCalculatedRole(
      Array.from(guild.roles.cache.values())
        .filter(userRoleFilter)
        .filter((r) => r !== introRole)
    )
  )
}

function findRoleByName(guild: Guild, name: string): Role | undefined {
  return Array.from(guild.roles.cache.values()).find((r) => r.name === name)
}

function userRoleFilter(role: Role): boolean {
  return role.name !== '@everyone' && !role.managed
}

function minCalculatedRole(roles: Role[]): Role {
  if (!roles.length) throw new Error('"roles" cannot be an empty array')
  return _.minBy(roles, (r: Role) => r.position) || roles[0]
}
