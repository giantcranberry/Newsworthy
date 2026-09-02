/** Domains that cannot be used to create a new account. */
const BLOCKED_REGISTRATION_DOMAINS = new Set(['gmail.com', 'hotmail.com'])

export const COMPANY_EMAIL_REQUIRED_MESSAGE =
  'Company/Organization Email Address required'

export function isBlockedRegistrationEmail(email: string): boolean {
  const at = email.lastIndexOf('@')
  if (at < 0) return false
  const domain = email.slice(at + 1).toLowerCase().trim()
  return BLOCKED_REGISTRATION_DOMAINS.has(domain)
}
