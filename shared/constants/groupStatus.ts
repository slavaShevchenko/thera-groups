/**
 * Group visibility, in one place shared by the catalog query, the detail lookup, the
 * sitemap and the UI badges. `shared/` must stay free of Prisma types, so the statuses
 * are plain literals that mirror the `GroupStatus` enum in `database/schema.prisma`.
 */

/**
 * Statuses an unprivileged visitor may see. A FULL group still has a public page — it is
 * a real event people bookmarked and a seat may free up — and a COMPLETED one is the
 * archive of a past event. Hiding either sends an indexed URL to 404.
 */
export const PUBLIC_GROUP_STATUSES = ['PUBLISHED', 'FULL', 'COMPLETED'] as const

export type PublicGroupStatus = typeof PUBLIC_GROUP_STATUSES[number]

export function isPublicGroupStatus(status: string): status is PublicGroupStatus {
  return (PUBLIC_GROUP_STATUSES as readonly string[]).includes(status)
}

/**
 * The only status that accepts applications. `FULL` and `COMPLETED` are visible but
 * closed, and a group whose `endsAt` has passed is closed whatever its status says —
 * nothing moves a row to `COMPLETED` automatically yet.
 */
export const APPLYABLE_GROUP_STATUS = 'PUBLISHED'

/**
 * Statuses whose group page keeps the apply button hidden and shows a closing badge
 * instead. Kept separate from `PUBLIC_GROUP_STATUSES` so adding a visible-but-closed
 * status is one edit in one file.
 */
export const CLOSED_GROUP_STATUSES = ['FULL', 'COMPLETED'] as const
