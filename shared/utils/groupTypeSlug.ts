import { GROUP_TYPES } from '../constants/groupTypes'

// Re-export from constants for backward compatibility
export {
  groupTypeToSlug,
  slugToGroupType,
  getGroupTypeByValue,
  getGroupTypeBySlug,
  GROUP_TYPES,
  LEGACY_SLUG_REDIRECTS,
} from '../constants/groupTypes'

// Alias for backward compatibility
export { slugToGroupType as slugToGroupTypeEnum } from '../constants/groupTypes'

// Map for backward compatibility
export const groupTypeSlugMap: Record<string, string> = Object.fromEntries(
  GROUP_TYPES.map(type => [type.value, type.slug]),
)
