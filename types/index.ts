export type Locale = 'ua' | 'en'

export type BackToSource = 'catalog' | 'my' | 'admin' | 'favorites' | 'organizer'

export interface Filters {
  q?: string
  type?: string
  format?: string
  dateFrom?: string
  /**
   * ISO 639-1 codes, matched with OR semantics: a group running in `uk, en` satisfies a
   * filter of `['uk']`, of `['en']`, and of `['uk', 'es']`.
   *
   * Travels the wire as one comma-separated `languages` param, the way `status` does on the
   * admin groups query. Empty or absent means "any language".
   */
  languages?: string[]
}

export interface Question {
  id: string
  question: string
  type: 'TEXT' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE'
  required: boolean
  options: string[]
}

export interface QuestionInput {
  id?: string
  question: string
  type: 'TEXT' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE'
  required: boolean
  options: string[]
}

export interface Answer {
  questionId: string
  question: string
  type: string
  value: string
}

export interface LanguageOption {
  code: string
  label: string
  searchName: string
}

export interface GroupCoOrganizer {
  userId: string
  role: string
  user?: {
    id: string
    firstName?: string
    lastName?: string
    avatarUrl?: string | null
    organizerProfile?: {
      firstName: string
      lastName: string
      avatarUrl: string | null
      slug: string
    } | null
  } | null
  firstName?: string
  lastName?: string
  avatarUrl?: string | null
}

/**
 * A co-organizer as a public payload carries it: a profile link, a name and the role they
 * hold on this group. No `userId` — the public endpoints stopped shipping it, since it is
 * the identifier every ownership check is made against.
 */
export interface PublicCoOrganizer {
  slug: string | null
  firstName: string
  lastName: string
  avatarUrl: string | null
  role: string
}

/**
 * Card shape, as returned by `GET /api/groups`, `/api/groups/latest` and the groups block
 * of a public organizer profile. `id` is the slug: the cuid never leaves the server.
 *
 * `status` and `endsAt` are here because a card has to say why it cannot be applied to —
 * `FULL` and `COMPLETED` are listed, and so is any group whose end date has passed. A null
 * `endsAt` means open-ended: still joinable however long ago the group began.
 */
export interface Group {
  id: string
  slug: string
  title: string
  type: string | null
  format: string | null
  location: string | null
  priceAmount: number | null
  currency: string
  capacity: number | null
  startsAt: string | null
  endsAt: string | null
  status: string
  organizer: {
    firstName: string
    lastName: string
    avatarUrl: string | null
  } | null
  coOrganizers?: PublicCoOrganizer[]
}

export interface GroupOrganizer {
  slug: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  qualification: string | null
  experienceYears: number | null
  specializations: string[]
  bio: string | null
  verificationStatus: string
}

/**
 * Detail shape, as returned by `GET /api/groups/[slug]`.
 *
 * `viewer` replaces the `organizer.userId` / `coOrganizers[].userId` the endpoint used to
 * publish so the page could run `can()` itself: the server decides once and sends the
 * answer, which keeps the ids out of an anonymous response and the permission rules out of
 * the client bundle.
 */
export interface GroupData {
  slug: string
  id: string
  isFavorited: boolean
  createdAt: string
  type: string | null
  title: string
  /**
   * `description` as renderable nodes. The stored markdown source never leaves the server —
   * the client carries no parser and nothing on this path uses `v-html`.
   */
  descriptionContent: MarkdownBlock[]
  /** `program` as renderable nodes. Empty when the organizer wrote no program. */
  programContent: MarkdownBlock[]
  /**
   * The description as prose, cut on a word boundary — what `<meta name="description">` and
   * the Event JSON-LD carry. Neither can take markdown syntax, and only the server has the
   * parser that removes it.
   */
  metaDescription: string
  format: string | null
  status: string
  startsAt: string | null
  endsAt: string | null
  timezone: string | null
  capacity: number | null
  minParticipants: number | null
  durationHours: number | null
  certificateIssued: boolean | null
  priceAmount: number | null
  currency: string
  location: string | null
  /** ISO 639-1 codes the event is conducted in. Empty when the organizer never set one. */
  languages: string[]
  tags: { name: string, slug: string }[]
  organizer: GroupOrganizer | null
  coOrganizers: PublicCoOrganizer[]
  viewer: {
    canEdit: boolean
    canViewUnpublished: boolean
  }
}

export interface MyGroup {
  id: string
  slug: string
  title: string
  status: string
  format: string | null
  type: string | null
  startsAt: string | null
  applicationsCount: number
  rejectionReason: string | null
  role: 'owner' | 'coOrganizer'
  ownerName?: string
  coOrganizers: GroupCoOrganizer[]
  createdAt: string
}

export interface OrganizerListItem {
  /**
   * The profile cuid, present for an ADMIN caller only — it is what `POST /api/groups`
   * takes as `organizerId` when an admin creates a group on somebody's behalf. The public
   * catalog identifies an organizer by `slug`, and the list endpoint omits this field for
   * everyone who cannot act on it.
   */
  id?: string
  firstName: string
  lastName: string
  slug: string
  avatarUrl: string | null
  city: string | null
  experienceYears: number | null
  specializations: string[]
  groupsCount: number
}

export interface OrganizerProfile {
  id: string
  slug: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  bio: string | null
  qualification: string | null
  experienceYears: number | null
  specializations: string[]
  workFormats: string[]
  languages: string[]
  city: string | null
  education: string[]
  professionalOrganization: string
  professionalOrganizationStatus: string
  telegramUrl: string | null
  instagramUrl: string | null
  linkedinUrl: string | null
  whatsappUrl: string | null
  facebookUrl: string | null
  youtubeUrl: string | null
  verificationStatus: string
  groups: Group[]
}

export interface OrganizerMe {
  id: string
  slug: string
  firstName: string
  lastName: string
  bio: string | null
  qualification: string | null
  avatarUrl: string | null
  experienceYears: number | null
  languages: string[]
  workFormats: string[]
  city: string | null
  education: string[]
  professionalOrganization: string
  professionalOrganizationStatus: string
  telegramUrl: string | null
  instagramUrl: string | null
  linkedinUrl: string | null
  whatsappUrl: string | null
  facebookUrl: string | null
  youtubeUrl: string | null
  verificationStatus: string
  rejectionReason: string | null
  specializations: string[]
}

export interface PendingProfile {
  id: string
  slug: string
  firstName: string
  lastName: string
  email: string
  bio: string | null
  qualification: string | null
  avatarUrl: string | null
  city: string | null
  experienceYears: number | null
  specializations: string[]
  createdAt: string
}

export interface AdminApplication {
  id: string
  name: string
  email: string
  phone: string | null
  message: string | null
  status: string
  createdAt: string
  group: { id: string, title: string, slug: string }
  answers: { question: string, type: string, value: string }[]
}

export interface ApplicationStats {
  total: number
  today: number
  week: number
  pending: number
  approved: number
  rejected: number
  withdrawn: number
}

export interface AdminOrganizer {
  id: string
  firstName: string
  lastName: string
  slug: string
  email: string
  isActive: boolean
  verificationStatus: string
  groupsCount: number
  createdAt: string
}

export interface UserRecord {
  id: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
}

export interface PendingGroup {
  id: string
  slug: string
  title: string
  status: string
  type: string | null
  format: string | null
  startsAt: string | null
  organizer: {
    id: string
    name: string
    slug: string
    avatarUrl: string | null
  }
  createdAt: string
  updatedAt: string
}

export interface CoOrganizer {
  userId: string
  role: string
  userName?: string
  avatarUrl?: string | null
}

export interface OrganizerSearchResult {
  /** The **user** id — what `GroupCoOrganizer.userId` and `updateGroupSchema.organizerId` take. */
  id: string
  /**
   * The **profile** id — what `Group.organizerId` and `Article.authorId` take.
   *
   * Both travel because the two vocabularies are both legitimate and neither is derivable
   * from the other on the client: `CoOrganizersPicker` reads `id`, the article author picker
   * reads `profileId`. Handing either one the wrong identifier is a foreign-key failure at
   * best and a silently misattributed row at worst. Null when the user has no organizer
   * profile — which this search cannot return today, but the shape should not promise that.
   */
  profileId?: string | null
  firstName: string
  lastName: string
  avatarUrl?: string | null
  slug?: string | null
}

export interface GroupFormData {
  title: string
  description: string
  program: string
  type: string
  format: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  timezone: string
  location: string
  /** ISO 639-1 codes, mirroring `Group.languages`. */
  languages: string[]
  priceAmount: number | null
  maxParticipants: number | null
  minParticipants: number | null
  durationHours: number | null
  certificateIssued: boolean | null
  questions: QuestionInput[]
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED'
  rejectionReason: string | null
  currency: string
  coOrganizers: CoOrganizer[]
}

export interface OrganizerProfileBrief {
  id: string
  firstName: string
  lastName: string
  verificationStatus: string
}

export interface UserProfile {
  id: string
  email: string
  role: string
  preferredLocale: string
  createdAt: string
  organizerProfile: {
    id: string
    slug: string
    firstName: string
    lastName: string
    avatarUrl: string | null
    bio: string | null
    qualification: string | null
    verificationStatus: string
    rejectionReason: string | null
  } | null
}

export interface AuthUser {
  id: string
  email: string
  role: string
  organizerProfile?: OrganizerProfileBrief | null
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  role: 'VISITOR' | 'ORGANIZER'
  preferredLocale?: Locale
  turnstileToken?: string
  /**
   * Mirrors `registerSchema.organizerData`. Every field is required: the three professional
   * fields are what `VERIFICATION_REQUIRED_FIELDS` checks before an admin may approve, and
   * `bio` is required because the edit form enforces it on save — a profile created without
   * one would be stuck at the edit form without backtracking.
   */
  organizerData?: {
    firstName: string
    lastName: string
    bio: string
    qualification: string
    professionalOrganization: string
    professionalOrganizationStatus: string
  }
}

export interface Application {
  id: string
  name: string
  email: string
  phone: string | null
  message: string | null
  status: string
  /** Set on a REJECTED row, null otherwise — the service clears it when a decision is reverted. */
  rejectionReason: string | null
  createdAt: string
  answers: Answer[]
}

export interface MyApplication {
  id: string
  groupId: string
  name: string
  email: string
  status: string
  createdAt: string
  group: {
    title: string
    slug: string
    /** Group status, so the page can link only to a group that is publicly reachable. */
    status: string
    startsAt: string
  }
  answersCount: number
}

export interface Notification {
  id: string
  type: string
  entityType: string
  entityId: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

// ==========================================
// Markdown
// ==========================================

/**
 * A markdown document as the client receives it: already parsed, and into a closed set of
 * node types rather than into HTML.
 *
 * The server runs `marked.lexer()` and maps the tokens onto these shapes
 * (`server/utils/markdown.ts`); `MarkdownContent.vue` renders them with real elements and
 * `{{ }}` interpolation. Nothing on this path uses `v-html`, which is why no HTML sanitizer
 * has to sit between an author's keystrokes and a visitor's browser — there is no HTML string
 * to sanitize. A node type that is not listed here cannot reach the client at all, so the
 * renderer can never be surprised by one.
 *
 * An article body is written by an admin and a group's description and program by a verified
 * organizer; both are rendered to anonymous visitors through this one node set.
 *
 * URLs are checked where they are parsed, not where they are rendered: `link.href` and
 * `image.src` only ever carry an `http(s)`, `mailto:` or root-relative target.
 */
export type MarkdownInline
  = | { type: 'text', text: string }
    | { type: 'strong', children: MarkdownInline[] }
    | { type: 'em', children: MarkdownInline[] }
    | { type: 'del', children: MarkdownInline[] }
    | { type: 'code', text: string }
    | { type: 'br' }
    | { type: 'link', href: string, title: string | null, children: MarkdownInline[] }
    | { type: 'image', src: string, alt: string, title: string | null }

/**
 * `heading.level` is the level *rendered*, not the number of `#` typed: a body never renders
 * alone, so the parser shifts it below whatever heading the page around it already used and
 * clamps at `6`. An article body starts at `2`, under the page's single `<h1>` title; a group's
 * description and program start at `3`, under the `h2` section heading that introduces them.
 * Two `h1`s on one page is a structured-data warning and a screen reader that announces the
 * title twice.
 */
export type MarkdownHeadingLevel = 2 | 3 | 4 | 5 | 6

export type MarkdownBlock
  = | { type: 'heading', level: MarkdownHeadingLevel, children: MarkdownInline[] }
    | { type: 'paragraph', children: MarkdownInline[] }
    | { type: 'blockquote', children: MarkdownBlock[] }
    | { type: 'code', text: string, lang: string | null }
    | { type: 'list', ordered: boolean, start: number, items: MarkdownBlock[][] }
    | { type: 'hr' }

// ==========================================
// Articles
// ==========================================

/**
 * The byline. `slug` is non-null only for a linked organizer whose profile has a public
 * page, which is the same rule `GroupCard` and the group page already apply — a name
 * without a slug renders as text rather than as a link to `/organizers/`.
 *
 * No `avatarUrl`: the byline is a line of text under the title, and a field nothing renders
 * is a field that should not be on the wire.
 */
export interface ArticleAuthor {
  name: string
  slug: string | null
}

export interface ArticleListItem {
  slug: string
  title: string
  excerpt: string
  /**
   * A bare `YYYY-MM-DD`, not an instant: an article has a publication day and the page prints
   * no time. Formatting it through `formatSiteDay()` rather than `formatDate()` is what keeps
   * the day from shifting for a visitor whose browser sits west of Kyiv.
   */
  publishedDate: string
  author: ArticleAuthor | null
}

/**
 * One row of the home page's latest-articles block: a date, a linked title and the byline,
 * and nothing else. The block renders no excerpt, so the payload carries none.
 */
export interface ArticleTeaser {
  slug: string
  title: string
  /** Bare `YYYY-MM-DD`; see `ArticleListItem.publishedDate`. */
  publishedDate: string
  author: ArticleAuthor | null
}

export interface ArticleData {
  slug: string
  locale: Locale
  title: string
  content: MarkdownBlock[]
  /** Plain-text cut of `content`, for the "read more" block and social previews. */
  excerpt: string
  /**
   * A shorter cut of the same text, sized for a search-result snippet. Derived server-side
   * from the same single parse as `excerpt`, so the two can never disagree about what the
   * article says.
   */
  metaDescription: string
  /** Bare `YYYY-MM-DD`; see `ArticleListItem.publishedDate`. */
  publishedDate: string
  /** ISO instant — `dateModified` in the Article JSON-LD, unless it precedes the publication day. */
  updatedAt: string
  author: ArticleAuthor | null
}

/**
 * One row of the admin list. The slug is the identifier here too — the edit page is
 * `/admin/articles/[slug]`, the way the group editor is `/groups/edit/[slug]`.
 *
 * `title` is best-effort: the Ukrainian one when it exists, otherwise the English one,
 * otherwise the slug. An admin recognises an article by any of the three.
 */
export interface AdminArticleListItem {
  slug: string
  status: 'DRAFT' | 'PUBLISHED'
  title: string
  /** Bare `YYYY-MM-DD`, null while the article has never been given a publication day. */
  publishedDate: string | null
  authorName: string | null
  /** Which translations are filled in — the publish gate is "both of them". */
  locales: Locale[]
  updatedAt: string
}

export interface AdminArticleTranslationInput {
  title: string
  content: string
}

/**
 * What the admin form loads and saves. `publishedAt` travels as a bare `YYYY-MM-DD`, which
 * is what a date input holds; the server reads it as a calendar day in the site zone via
 * `startOfSiteDay()`, the same way a group's `dateFrom` filter is read.
 */
export interface AdminArticleFormData {
  slug: string
  status: 'DRAFT' | 'PUBLISHED'
  authorId: string | null
  /**
   * Free-text byline, mutually exclusive with `authorId` — the database CHECKs it and the
   * validator refuses both at once.
   */
  authorName: string | null
  /**
   * The linked organizer's name, read-only.
   *
   * Not an input: the form never writes it. It exists because `authorId` is an opaque cuid,
   * so an edit form loaded without it would show an author picker that is selected and
   * visibly empty. The picker renders this as the chosen row and drops it on clear.
   */
  linkedAuthorName: string | null
  publishedAt: string | null
  translations: Partial<Record<Locale, AdminArticleTranslationInput>>
}
