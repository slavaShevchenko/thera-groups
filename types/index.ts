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

export interface Group {
  id: string
  slug: string
  title: string
  description: string
  format: string | null
  type: string | null
  location: string | null
  priceAmount: number | null
  currency: string
  capacity: number | null
  startsAt: string | null
  organizer: {
    firstName: string
    lastName: string
    avatarUrl: string | null
  }
  coOrganizers?: GroupCoOrganizer[]
}

export interface GroupOrganizer {
  id: string
  userId: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  qualification: string
  bio: string
  slug: string
}

export interface GroupData {
  slug: string
  id: string
  isFavorited: boolean
  createdAt: string
  updatedAt: string
  type: string | null
  title: string
  description: string
  format: string | null
  status: string
  startsAt: string | null
  endsAt: string | null
  capacity: number | null
  priceAmount: number | null
  currency: string
  location: string | null
  organizer: GroupOrganizer
  coOrganizers: GroupCoOrganizer[]
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
  education: string | null
  telegramUrl: string | null
  instagramUrl: string | null
  linkedinUrl: string | null
  whatsappUrl: string | null
  facebookUrl: string | null
  youtubeUrl: string | null
  tiktokUrl: string | null
  verificationStatus: string
  groups: Group[]
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
  type: string
  format: string
  startDate: string
  endDate: string
  time: string
  location: string
  priceAmount: number | null
  maxParticipants: number | null
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
