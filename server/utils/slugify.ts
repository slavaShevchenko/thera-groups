const translitMap: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye',
  ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'i', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ю: 'yu',
  я: 'ya', ь: '',
}

export function slugify(text: string): string {
  const lower = text.toLowerCase()
  const translit = lower.split('').map(c => translitMap[c] ?? c).join('')
  return translit
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function randomSuffix(length = 4): string {
  return Math.random().toString(36).slice(2, 2 + length)
}

export async function generateUniqueSlug(
  baseText: string,
  isTaken: (_s: string) => Promise<boolean>,
): Promise<string> {
  const baseSlug = slugify(baseText)
  let slug = `${baseSlug}-${randomSuffix()}`

  for (let i = 0; i < 5; i++) {
    if (!(await isTaken(slug))) return slug
    slug = `${baseSlug}-${randomSuffix()}`
  }

  return slug
}
