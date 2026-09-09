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
  { value: 'CONFERENCE', slug: 'conference' },
  { value: 'CERTIFICATION', slug: 'certification' },
  { value: 'SPECIALIZATION', slug: 'specialization' },
  { value: 'FOUNDATION', slug: 'foundation' },
  { value: 'ADVANCED', slug: 'advanced' },
  { value: 'PROFESSIONAL', slug: 'professional' },
  { value: 'MODULAR', slug: 'modular' },
  { value: 'PARTNERSHIP', slug: 'partnership' },
  { value: 'INTERNATIONAL', slug: 'international' },
  { value: 'PILOT', slug: 'pilot' },
  { value: 'OTHER', slug: 'other' },
]

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
