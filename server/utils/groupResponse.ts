import type { groupRepository } from '../repositories/groupRepository'
import { GROUP_LIMITS } from '~~/shared/constants/limits'
import type { MarkdownOptions } from './markdown'
import { markdownToText, parseMarkdown, truncateText } from './markdown'

/**
 * Public response mappers for group endpoints.
 *
 * Every handler below used to return either a hand-picked object that still carried
 * `organizer.userId` and `coOrganizers[].userId`, or — for the list endpoints — raw Prisma
 * rows from an `include`, which ship every scalar column: `organizerId`, `timezone`,
 * `rejectionReason` and the group's own cuid. All of it is reachable by an anonymous
 * visitor, and `userId` is the key every other endpoint trusts for ownership checks.
 *
 * Two rules hold here:
 *  - the group's public identifier is its slug, so `id` is the slug and the cuid never
 *    leaves the server;
 *  - nothing an anonymous visitor cannot see on the page is in the payload.
 *
 * Privilege is decided by the handler with `can()` and passed in as plain booleans, so the
 * client stops re-implementing permission logic over ids it should not receive.
 */

type GroupDetailRow = NonNullable<Awaited<ReturnType<typeof groupRepository.findBySlug>>>
type GroupListRow = Awaited<ReturnType<typeof groupRepository.findLatest>>[number]

/**
 * What a card actually reads.
 *
 * Declared as a `Pick` of the list row rather than as the list row itself so a caller may
 * hand over a narrower `select`: the public organizer profile does, because an `include`
 * there would ship every scalar column of every group — `organizerId`, `timezone`, the
 * cuid — to an anonymous visitor for a block that renders eleven fields.
 */
type GroupCardRow = Pick<GroupListRow,
  | 'slug' | 'title' | 'type' | 'format' | 'location' | 'startsAt' | 'endsAt'
  | 'capacity' | 'priceAmount' | 'currency' | 'status' | 'organizer' | 'coOrganizers'>

/** What the caller is allowed to do with this group, computed server-side. */
export interface GroupViewerContext {
  isFavorited: boolean
  canEdit: boolean
  /** Owner, co-organizer or admin — the only viewers a non-public group is rendered for. */
  canViewUnpublished: boolean
}

/**
 * A Prisma `Decimal` reaches JSON as a string, which made `formatPrice` render `0.00 ₴`
 * for a free group instead of its "free" label, since it compares against the number 0.
 * The declared client type has always said `number | null`; this makes it true.
 */
function toAmount(value: GroupDetailRow['priceAmount']): number | null {
  return value === null || value === undefined ? null : Number(value)
}

function mapCoOrganizer(co: GroupDetailRow['coOrganizers'][number]) {
  const profile = co.user?.organizerProfile

  return {
    // `slug` is the link to the co-organizer's public profile; null when the account has
    // no profile, in which case the UI renders the name without a link.
    slug: profile?.slug ?? null,
    firstName: profile?.firstName ?? '',
    lastName: profile?.lastName ?? '',
    avatarUrl: profile?.avatarUrl ?? null,
    role: co.role,
  }
}

/**
 * How a group's `description` and `program` are parsed, and both halves are about what they
 * were before they were markdown:
 *
 * - `breaks: true` keeps every single newline a line break. These two fields are written in a
 *   plain textarea and were displayed with `white-space: pre-wrap`, so parsing them as
 *   markdown without it would collapse every description already published into one
 *   paragraph — a reflow of live content caused by a change to how it is read, not written.
 * - `headingOffset: 2` puts `#` at `h3`. The page introduces each of these bodies with an
 *   `h2` section heading of its own, and a body heading beside it would make the two peers
 *   in the outline a screen reader and a crawler both read.
 */
const GROUP_MARKDOWN: MarkdownOptions = { headingOffset: 2, breaks: true }

/**
 * Full detail payload for `GET /api/groups/[slug]`.
 */
export function mapGroupForPublic(group: GroupDetailRow, ctx: GroupViewerContext) {
  const organizer = group.organizer
  const descriptionContent = parseMarkdown(group.description, GROUP_MARKDOWN)

  return {
    id: group.slug,
    slug: group.slug,
    title: group.title,
    // Both bodies go out as parsed nodes, not as the stored markdown and not as HTML: the
    // client carries no markdown parser and nothing on this path uses `v-html`. An empty
    // `programContent` is what an organizer who wrote no program produces, and the page
    // hides the section on it.
    descriptionContent,
    programContent: parseMarkdown(group.program, GROUP_MARKDOWN),
    // The description as prose, for the two consumers that need words rather than structure:
    // `<meta name="description">` and the Event JSON-LD. Cut here rather than on the page so
    // neither can advertise `##` and `**` to a search engine, and cut on a word boundary
    // rather than at the 160th character of whatever the source happened to be.
    metaDescription: truncateText(
      markdownToText(descriptionContent),
      GROUP_LIMITS.META_DESCRIPTION_MAX,
    ),
    type: group.type,
    format: group.format,
    location: group.location,
    // The languages the event is conducted in. Detail only: a card has no room for them and
    // the catalog does not filter on them yet.
    languages: group.languages,
    startsAt: group.startsAt,
    endsAt: group.endsAt,
    timezone: group.timezone,
    capacity: group.capacity,
    minParticipants: group.minParticipants,
    durationHours: group.durationHours,
    certificateIssued: group.certificateIssued,
    priceAmount: toAmount(group.priceAmount),
    currency: group.currency,
    status: group.status,
    createdAt: group.createdAt,
    // Tag ids are cuids the public page has no use for; name and slug are what it renders.
    tags: group.tags.map(tag => ({ name: tag.name, slug: tag.slug })),
    organizer: organizer
      ? {
          slug: organizer.slug,
          firstName: organizer.firstName,
          lastName: organizer.lastName,
          avatarUrl: organizer.avatarUrl,
          qualification: organizer.qualification,
          experienceYears: organizer.experienceYears,
          specializations: organizer.specializations,
          bio: organizer.bio,
          verificationStatus: organizer.verificationStatus,
        }
      : null,
    coOrganizers: group.coOrganizers.map(mapCoOrganizer),
    isFavorited: ctx.isFavorited,
    viewer: {
      canEdit: ctx.canEdit,
      canViewUnpublished: ctx.canViewUnpublished,
    },
  }
}

/**
 * Card payload for the list endpoints — `GET /api/groups`, `/api/groups/latest` and the
 * groups block on a public organizer profile. Shorter than the detail on purpose: no
 * `program`, no `description` body beyond what a card renders, no questions and no tags.
 *
 * `status` and `endsAt` are here because a card now has to say why it cannot be applied
 * to: `FULL` and `COMPLETED` are listed, and so is any group whose end date has passed.
 */
export function mapGroupCard(group: GroupCardRow) {
  const organizer = group.organizer

  return {
    id: group.slug,
    slug: group.slug,
    title: group.title,
    type: group.type,
    format: group.format,
    location: group.location,
    startsAt: group.startsAt,
    endsAt: group.endsAt,
    capacity: group.capacity,
    priceAmount: toAmount(group.priceAmount),
    currency: group.currency,
    status: group.status,
    organizer: organizer
      ? {
          firstName: organizer.firstName,
          lastName: organizer.lastName,
          avatarUrl: organizer.avatarUrl,
        }
      : null,
    coOrganizers: group.coOrganizers.map(mapCoOrganizer),
  }
}

export type PublicGroup = ReturnType<typeof mapGroupForPublic>
export type PublicGroupCard = ReturnType<typeof mapGroupCard>
