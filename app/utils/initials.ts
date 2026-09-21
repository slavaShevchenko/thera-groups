export function getInitials(firstName?: string, lastName?: string): string {
  const f = (firstName?.[0] || '').toUpperCase()
  const l = (lastName?.[0] || '').toUpperCase()
  return (f + l) || '?'
}
