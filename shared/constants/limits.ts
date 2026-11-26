export const LIMITS = {
  MAX_QUESTIONS_PER_GROUP: 10,
  MAX_OPTIONS_PER_QUESTION: 10,
  MAX_EXPERIENCE_YEARS: 50,
  MIN_PASSWORD_LENGTH: 8,
  COUNTER_DISPLAY_CAP: 99,
  DEFAULT_START_HOUR: 10,
  // Pre-fill for the end-date picker. Must be > 0: the DB requires endsAt > startsAt.
  DEFAULT_END_OFFSET_HOURS: 2,
  /**
   * ISO 639-1 codes one row may carry, shared by `OrganizerProfile.languages` and
   * `Group.languages` so the two validators cannot drift — a group runs in the languages its
   * organizer speaks, and a filter over one column must not reject what the other accepted.
   *
   * `iso-639-1` knows ~180 codes, so 20 is generous; it is a ceiling on a stored array, not
   * a target anybody aims at.
   */
  LANGUAGE_CODES_MAX: 20,
} as const

export const GROUP_LIMITS = {
  TITLE_MAX: 400,
  /**
   * Shortest accepted group title, shared by `createGroupSchema`, the `/groups/new` submit
   * button and the editor's publish checklist. One number because all three gate the same
   * thing: a title too short to cut a meaningful slug out of.
   */
  TITLE_MIN: 3,
  DESCRIPTION_MAX: 4000,
  PROGRAM_MAX: 4000,
  QUESTION_TEXT_MAX: 600,
  OPTION_TEXT_MAX: 400,
  LOCATION_MAX: 400,
  CO_ORGANIZER_ROLE_MAX: 200,
  /**
   * Ceiling on a group's whole slug, uniqueness suffix included.
   *
   * Wider than the 40 `slugify()` defaults to, because a group slug is cut from a title of up
   * to `TITLE_MAX` characters and still has to read as that title afterwards: at 40 the base
   * for «Очна інтервізійна група EAGT у Кракові» lost its last two words mid-syllable.
   * Organizer and article slugs keep the default — theirs are already live at 40.
   */
  SLUG_MAX: 60,
} as const

/**
 * Organizer avatar upload constraints, shared so the browser and the handler cannot drift.
 *
 * `MAX_FILE_BYTES` bounds the image, `MAX_BODY_BYTES` the whole multipart request — the
 * extra 256 KiB covers framing and any field a client sends alongside the file.
 *
 * The size is set by the platform rather than by taste. Vercel refuses any request body over
 * **4.5 MB** with `413 FUNCTION_PAYLOAD_TOO_LARGE` *before the function runs*, on every plan,
 * with no setting that raises it. A limit above that is a promise the deployment cannot keep:
 * the file clears the browser check and the handler check, then dies at the edge with a body
 * this client cannot parse, so `AvatarUploader` falls back to a generic "upload failed" and
 * the organizer is never told the real reason. 4 MiB leaves roughly half a megabyte of
 * headroom under either reading of "4.5 MB" (decimal or binary).
 *
 * Raising it means moving uploads off the function — a presigned URL straight to Supabase
 * Storage — not editing this constant.
 */
export const AVATAR_LIMITS = {
  MAX_FILE_BYTES: 4 * 1024 * 1024,
  MAX_BODY_BYTES: 4 * 1024 * 1024 + 256 * 1024,
  /** Declared types both sides accept. The server still validates magic bytes, because a
   *  declared type is client-controlled. */
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
} as const

/**
 * Sitemap size ceiling, shared so the two `take` values cannot drift apart and push the
 * file over the protocol limit.
 *
 * sitemaps.org caps one sitemap at **50 000 `<url>` entries**; past that Google rejects the
 * whole file rather than truncating it, so every URL is lost, not just the excess. This site
 * emits two entries per row — one per locale — so the row budget is half the URL budget,
 * shared between groups, organizers and articles, minus the static paths and the category
 * pages that are always listed.
 *
 * Both numbers are deliberately round rather than exact: 11 000 rows × 2 locales × 2 entities
 * = 44 000 URLs, plus 2 000 article rows × 2 locales = 4 000, giving 48 000 and leaving
 * ~2 000 of headroom under the 50 000 cap for the fixed entries and for whichever entity
 * grows first. Articles get a smaller slice because they are hand-written editorial content:
 * a table that an admin fills in one at a time does not reach five figures, and the rows it
 * would give up are the ones least worth a URL. All three queries are ordered by
 * `updatedAt desc`, so a truncation drops the stalest pages, which is the right thing to lose.
 *
 * Adding a fourth entity means re-dividing `50 000 / 2 locales`, not reusing a constant.
 * Crossing the budget means a sitemap index with chunked children, not a bigger number here.
 */
export const SITEMAP_LIMITS = {
  MAX_ROWS_PER_ENTITY: 11000,
  MAX_ARTICLE_ROWS: 2000,
} as const

export const PROFILE_LIMITS = {
  /**
   * The floor every required profile text field shares, server and client. Below it the
   * field is a way past "required" rather than an answer — one character is not a name, a
   * qualification or an organization.
   */
  REQUIRED_TEXT_MIN: 2,
  BIO_MAX: 2000,
  FIRST_NAME_MAX: 100,
  LAST_NAME_MAX: 100,
  SPECIALIZATION_MAX: 100,
  CITY_MAX: 100,
  SOCIAL_URL_MAX: 300,
  EDUCATION_MAX: 300,
  QUALIFICATION_MAX: 500,
  PROFESSIONAL_ORG_MAX: 300,
  PROFESSIONAL_ORG_STATUS_MAX: 300,
} as const

export const ARTICLE_LIMITS = {
  TITLE_MAX: 200,
  /**
   * Markdown source of one locale's version. Generous on purpose — this is a ceiling on a
   * hand-pasted essay, not a target: 100 000 characters is roughly 16 000 words, well past
   * anything the form is for, and low enough that one row cannot become a payload.
   */
  CONTENT_MAX: 100_000,
  AUTHOR_NAME_MAX: 150,
  /** Same ceiling `slugify()` cuts at, so a slug typed by hand cannot outgrow the generator. */
  SLUG_MAX: 40,
  /** Articles the public list shows per page — the brief asked for ten headlines. */
  PAGE_SIZE: 10,
  /**
   * Headlines the home page's latest-articles block shows: two rows of three, the same count
   * the latest-events block above it uses.
   */
  HOME_TEASER_COUNT: 6,
  /**
   * Characters of plain text the list card and the meta description are cut from.
   *
   * One number for both, and the card clamps visually on top of it (`-webkit-line-clamp`),
   * because the two have to agree: a description longer than the snippet would have Google
   * show text a visitor never saw on the page that ranked for it. 320 is ~6 lines at the
   * card's width and still yields a full 155-character `EXCERPT_META_MAX` cut.
   */
  EXCERPT_MAX: 320,
  /** Search engines truncate a meta description past ~155–160 characters. */
  META_DESCRIPTION_MAX: 155,
} as const
