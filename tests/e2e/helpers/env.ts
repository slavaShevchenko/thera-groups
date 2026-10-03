interface E2ECredentials {
  email: string
  password: string
}

export const credentials: E2ECredentials = {
  email: process.env.E2E_ORGANIZER_EMAIL ?? '',
  password: process.env.E2E_ORGANIZER_PASSWORD ?? '',
}

// Any group the signed-in organizer may edit. The specs only drive validation states,
// which useGroupForm refuses to autosave, and every write is stubbed in helpers/network.
export const groupSlug = process.env.E2E_GROUP_SLUG ?? ''

export const hasCredentials = Boolean(credentials.email && credentials.password)

export const missingCredentials = [
  'E2E_ORGANIZER_EMAIL',
  'E2E_ORGANIZER_PASSWORD',
].filter(name => !process.env[name])
