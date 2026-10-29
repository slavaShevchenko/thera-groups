export type Locale = 'ua' | 'en'

export type BackToSource = 'catalog' | 'my' | 'admin' | 'favorites' | 'organizer'

export interface Filters {
  q?: string
  type?: string
  format?: string
  dateFrom?: string
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
 * `FULL` and `COMPLETED` are listed, and so is any group whose start date has passed.
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
  description: string
  program: string | null
  format: string | null
  status: string
  startsAt: string | null
  endsAt: string | null
  capacity: number | null
  minParticipants: number | null
  durationHours: number | null
  certificateIssued: boolean | null
  priceAmount: number | null
  currency: string
  location: string | null
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
  id: string
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
  id: string
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
  time: string
  location: string
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
  organizerData?: {
    firstName: string
    lastName: string
    bio?: string
    qualification?: string
  }
}

export interface Application {
  id: string
  name: string
  email: string
  phone: string | null
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
