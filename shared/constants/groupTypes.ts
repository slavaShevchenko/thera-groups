export interface GroupType {
  value: string
  slug: string
}

export const GROUP_TYPES: GroupType[] = [
  { value: 'THERAPEUTIC', slug: 'therapeutic' },
  { value: 'WORKSHOP', slug: 'workshop' },
  { value: 'SEMINAR', slug: 'seminar' },
  { value: 'LECTURE', slug: 'lecture' },
  { value: 'LECTURE_COURSE', slug: 'lecture-course' },
  { value: 'INTENSIVE', slug: 'intensive' },
  { value: 'AUTHOR_PROGRAM', slug: 'author-program' },
  { value: 'SUPERVISION', slug: 'supervision' },
  { value: 'INTERVISION', slug: 'intervision' },
  { value: 'CONFERENCE', slug: 'conference' },
  { value: 'SYMPOSIUM', slug: 'symposium' },
  { value: 'CERTIFICATION', slug: 'certification' },
  { value: 'SPECIALIZATION', slug: 'specialization' },
  { value: 'EDUCATIONAL_PROGRAMS', slug: 'educational-programs' },
  { value: 'MODULAR', slug: 'modular' },
  { value: 'PILOT', slug: 'pilot' },
  { value: 'OTHER', slug: 'other' },
]

export const groupTypeSlugMap: Record<string, string> = Object.fromEntries(
  GROUP_TYPES.map(type => [type.value, type.slug]),
)

// Helper functions
export function getGroupTypeByValue(value: string): GroupType | undefined {
  return GROUP_TYPES.find(type => type.value === value)
}

export function getGroupTypeBySlug(slug: string): GroupType | undefined {
  return GROUP_TYPES.find(type => type.slug === slug)
}

export function groupTypeToSlug(value: string): string {
  return getGroupTypeByValue(value)?.slug || ''
}

export function slugToGroupType(slug: string): string {
  return getGroupTypeBySlug(slug)?.value || ''
}
