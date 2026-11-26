import { randomBytes } from 'node:crypto'
import { ConflictError } from './domainErrors'

const translitMap: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye',
  ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'i', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ю: 'yu',
  я: 'ya', ь: '',
}

/**
 * Default ceiling on a whole slug, suffix included. `ARTICLE_LIMITS.SLUG_MAX` mirrors it for
 * a slug an admin types by hand; a caller that needs a wider URL passes `maxLength` instead
 * of moving this, because organizer and article slugs are already live at 40.
 */
const DEFAULT_MAX_SLUG_LENGTH = 40

/**
 * Cuts an over-long slug back to `maxLength`, preferring to drop a whole trailing word over
 * half of one: `ochna-interviziina-hrupa-eagt` still reads as the title it came from, while
 * a hard `.slice()` gave `ochna-interviziina-hrupa-eagt-u-k`.
 *
 * A slug with no hyphen inside the budget is one long word and is hard-cut — returning
 * nothing there would leave the caller with no slug at all.
 */
function truncateAtWordBoundary(slug: string, maxLength: number): string {
  if (slug.length <= maxLength) return slug
  const cut = slug.slice(0, maxLength)
  const lastHyphen = cut.lastIndexOf('-')
  return lastHyphen > 0 ? cut.slice(0, lastHyphen) : cut
}

export function slugify(text: string | null | undefined, maxLength = DEFAULT_MAX_SLUG_LENGTH): string {
  const lower = (text ?? '').toLowerCase()
  const translit = lower.split('').map(c => translitMap[c] ?? c).join('')
  const slug = translit
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return truncateAtWordBoundary(slug, maxLength)
}

export function randomSuffix(length = 6): string {
  return randomBytes(length).toString('hex').slice(0, length)
}

export interface UniqueSlugOptions {
  /**
   * Suffix on the first try too, rather than offering the bare base.
   *
   * A bare base suits a caller whose base is expected to be unique on its own — a person's
   * name, an article headline. A group asks for the suffix always, because its base is a
   * title two organizers may legitimately share («Група підтримки для батьків»), and then
   * uniqueness rests on the suffix rather than on winning the race between the `isTaken`
   * probe and the INSERT.
   */
  alwaysSuffix?: boolean
  /** Ceiling on the finished slug, suffix included. Defaults to `DEFAULT_MAX_SLUG_LENGTH`. */
  maxLength?: number
}

export async function generateUniqueSlug(
  baseText: string,
  isTaken: (_s: string) => Promise<boolean>,
  options: UniqueSlugOptions = {},
): Promise<string> {
  const maxLength = options.maxLength ?? DEFAULT_MAX_SLUG_LENGTH
  const base = slugify(baseText, maxLength).replace(/^-+/, '') || 'item'

  // The base gives up its own tail to keep the whole slug inside `maxLength`, so the budget
  // is re-cut for every suffix length rather than once.
  const fit = (suffix: string) =>
    `${truncateAtWordBoundary(base, maxLength - suffix.length)}${suffix}`.replace(/-+$/, '')

  for (let i = 0; i <= 5; i++) {
    const suffix = i === 0 && !options.alwaysSuffix ? '' : `-${randomSuffix(6)}`
    const candidate = fit(suffix)
    if (!(await isTaken(candidate))) return candidate
  }

  const finalSuffix = `-${randomSuffix(10)}`
  const finalCandidate = fit(finalSuffix)
  if (!(await isTaken(finalCandidate))) return finalCandidate

  throw new ConflictError('Could not generate unique slug')
}
