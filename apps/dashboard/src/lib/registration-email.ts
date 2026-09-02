/** Exact domains that cannot be used to create a new account. */
const BLOCKED_REGISTRATION_DOMAINS = new Set(['gmail.com', 'hotmail.com'])

/** Country-code TLDs whose addresses cannot register (e.g. example.in, foo.co.in). */
const BLOCKED_REGISTRATION_TLDS = ['.in'] as const

export const COMPANY_EMAIL_REQUIRED_MESSAGE =
  'Company/Organization Email Address required'

export function isBlockedRegistrationEmail(email: string): boolean {
  const at = email.lastIndexOf('@')
  if (at < 0) return false
  const domain = email.slice(at + 1).toLowerCase().trim()
  if (!domain) return false
  if (BLOCKED_REGISTRATION_DOMAINS.has(domain)) return true
  return BLOCKED_REGISTRATION_TLDS.some(
    (tld) => domain === tld.slice(1) || domain.endsWith(tld)
  )
}
