import { randomBytes } from 'node:crypto'
import { ConflictError } from './domainErrors'

const translitMap: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye',
  ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'i', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ю: 'yu',
  я: 'ya', ь: '',
}

export function slugify(text: string | null | undefined): string {
  const lower = (text ?? '').toLowerCase()
  const translit = lower.split('').map(c => translitMap[c] ?? c).join('')
  return translit
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function randomSuffix(length = 6): string {
  return randomBytes(length).toString('hex').slice(0, length)
}

const MAX_SLUG_LENGTH = 40

export async function generateUniqueSlug(
  baseText: string,
  isTaken: (_s: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(baseText).replace(/^-+/, '') || 'item'

  for (let i = 0; i <= 5; i++) {
    const suffix = i === 0 ? '' : `-${randomSuffix(6)}`
    const candidate = `${base.slice(0, MAX_SLUG_LENGTH - suffix.length)}${suffix}`.replace(/-+$/, '')
    if (!(await isTaken(candidate))) return candidate
  }

  const finalSuffix = `-${randomSuffix(10)}`
  const finalCandidate = `${base.slice(0, MAX_SLUG_LENGTH - finalSuffix.length)}${finalSuffix}`.replace(/-+$/, '')
  if (!(await isTaken(finalCandidate))) return finalCandidate

  throw new ConflictError('Could not generate unique slug')
}
