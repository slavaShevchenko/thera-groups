import type { Prisma, Role } from '@prisma/client'
import { prisma } from '../utils/prisma'
import type { PrismaClientOrTx } from './types'

/**
 * What an auth handler may hand back to the browser after a sign-in.
 *
 * Deliberately a `select` and not an `include`: the full `User` row carries `authId` and the
 * full `OrganizerProfile` row carries `userId` and `rejectionReason`, none of which a client
 * has any use for. `userId` in particular is the value every ownership check trusts.
 */
const sessionUserSelect = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  preferredLocale: true,
  organizerProfile: {
    select: {
      id: true,
      slug: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      verificationStatus: true,
    },
  },
} as const

export type SessionUser = Prisma.UserGetPayload<{ select: typeof sessionUserSelect }>

export const userRepository = {
  /**
   * Finds a user by ID with their organizer profile.
   * @param id - The user ID
   * @returns The user with organizer profile or null if not found
   */
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { organizerProfile: true },
    })
  },

  /**
   * Finds a user by their Supabase auth ID with organizer profile.
   * @param authId - The Supabase auth user ID
   * @returns The user with organizer profile or null if not found
   */
  async findByAuthId(authId: string) {
    return prisma.user.findUnique({
      where: { authId },
      include: { organizerProfile: true },
    })
  },

  /**
   * The sign-in shape of a user, resolved by Supabase auth ID.
   * @param authId - The Supabase auth user ID
   * @returns The client-safe user, or null if the auth identity has no local row
   */
  async findSessionUserByAuthId(authId: string): Promise<SessionUser | null> {
    return prisma.user.findUnique({ where: { authId }, select: sessionUserSelect })
  },

  /**
   * The sign-in shape of a user, resolved by normalized email.
   *
   * The caller must pass an address already through `normalizeEmail()`: `email` is
   * `@unique` and compared byte-for-byte, so a differently-cased address reads as "no such
   * user" and the sign-in creates a second account instead of finding the first.
   * @param email - The normalized email address
   * @returns The client-safe user, or null if no local row holds that address
   */
  async findSessionUserByEmail(email: string): Promise<SessionUser | null> {
    return prisma.user.findUnique({ where: { email }, select: sessionUserSelect })
  },

  /**
   * Which Supabase auth identity, if any, already holds this address.
   *
   * `authId` is nullable and is never part of a client-facing payload, so it gets its own
   * lookup: the OAuth handler needs it to tell "a password sign-up meeting Google for the
   * first time" from "somebody else's account", and must not leak it by widening the
   * session select above.
   * @param email - The normalized email address
   * @returns The row id with its authId, or null if the address is free
   */
  async findAuthLinkByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, authId: true },
    })
  },

  /**
   * The row id behind a normalized address, for the one lookup that has to bridge a guest
   * action to the account that later registered with the same address.
   * @param email - The normalized email address
   * @returns The user id, or null if the address is unknown
   */
  async findIdByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })
  },

  /**
   * Finds all users with optional role filter and pagination for admin panel.
   * @param options - Optional role filter and skip/take pagination
   * @returns Object with users array and total count
   */
  async findAll(options: {
    role?: Role
    skip?: number
    take?: number
  } = {}) {
    const { role, skip = 0, take = 50 } = options
    const where: Prisma.UserWhereInput = role ? { role } : {}

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: { organizerProfile: true },
      }),
      prisma.user.count({ where }),
    ])

    return { users, total }
  },

  /**
   * Updates a user's data by ID.
   * @param id - The user ID
   * @param data - Prisma update input for the user
   * @returns The updated user record
   */
  async update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data })
  },

  /**
   * Deletes a user by ID.
   * @param id - The user ID
   * @returns The deleted user record
   */
  async delete(id: string) {
    return prisma.user.delete({ where: { id } })
  },

  /**
   * Finds active organizer users by IDs, used to validate co-organizer assignments.
   *
   * Takes the transaction because its only caller runs inside one: a read through the
   * module-level client would check a second connection out of the pool for the duration
   * of the transaction, and the pool is deliberately two connections deep.
   * @param ids - Array of user IDs to validate
   * @param tx - The transaction the validation belongs to
   * @returns Array of matching user IDs that are active organizers
   */
  async findValidOrganizerUsers(ids: string[], tx: PrismaClientOrTx = prisma) {
    return (tx as PrismaClientOrTx).user.findMany({
      where: {
        id: { in: ids },
        role: 'ORGANIZER',
        isActive: true,
      },
      select: { id: true },
    })
  },
}
