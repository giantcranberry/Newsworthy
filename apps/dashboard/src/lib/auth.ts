import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import LinkedIn from 'next-auth/providers/linkedin'
import { compare } from 'bcryptjs'
import { pbkdf2Sync } from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { users, userProfiles, partners, partnerManagers } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { addContactToSalesNexus } from '@/lib/salesnexus'
import { sendSmsNotification } from '@/lib/twilio'
import { sendNewsMarketingBookEmail } from '@/lib/email'
import { isBlockedRegistrationEmail } from '@/lib/registration-email'

export const IMPERSONATE_COOKIE = 'impersonate_user_id'
export const IMPERSONATE_ADMIN_COOKIE = 'impersonate_admin_id'

// Verify Werkzeug-style password hashes (pbkdf2:sha256:...)
function verifyWerkzeugPassword(password: string, hash: string): boolean {
  try {
    // Werkzeug format: method$salt$hash or pbkdf2:sha256:iterations$salt$hash
    if (hash.startsWith('pbkdf2:')) {
      const parts = hash.split('$')
      if (parts.length !== 3) return false

      const methodPart = parts[0] // e.g., "pbkdf2:sha256:260000"
      const salt = parts[1]
      const storedHash = parts[2]

      const methodParts = methodPart.split(':')
      const hashMethod = methodParts[1] || 'sha256'
      const iterations = parseInt(methodParts[2] || '260000', 10)

      const derivedKey = pbkdf2Sync(
        password,
        salt,
        iterations,
        32, // key length
        hashMethod
      )

      return derivedKey.toString('hex') === storedHash
    }
    return false
  } catch (error) {
    console.error('[Auth] Error verifying Werkzeug password:', error)
    return false
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('[Auth] Missing email or password')
          return null
        }

        const email = (credentials.email as string).toLowerCase()
        const password = credentials.password as string

        try {
          const user = await db.query.users.findFirst({
            where: eq(users.email, email),
          })

          if (!user) {
            console.log('[Auth] User not found:', email)
            return null
          }

          if (!user.passwordHash) {
            console.log('[Auth] User has no password hash:', email)
            return null
          }

          // Try Werkzeug (PBKDF2) first, then bcrypt
          let isPasswordValid = false
          if (user.passwordHash.startsWith('pbkdf2:')) {
            isPasswordValid = verifyWerkzeugPassword(password, user.passwordHash)
          } else {
            // Fall back to bcrypt for newer passwords
            isPasswordValid = await compare(password, user.passwordHash)
          }

          if (!isPasswordValid) {
            console.log('[Auth] Invalid password for:', email)
            return null
          }

          // Get profile separately
          const profile = await db.query.userProfiles.findFirst({
            where: eq(userProfiles.userId, user.id),
          })

          // Get managed partner IDs
          const managedRows = await db
            .select({ partnerId: partnerManagers.partnerId })
            .from(partnerManagers)
            .where(eq(partnerManagers.userId, user.id))
          const managedPartnerIds = managedRows.map(r => r.partnerId)

          console.log('[Auth] Login successful for:', email)

          return {
            id: user.id.toString(),
            email: user.email,
            name: profile?.firstName
              ? `${profile.firstName} ${profile.lastName || ''}`
              : user.email,
            isAdmin: user.isAdmin,
            isEditor: user.isEditor,
            isStaff: user.isStaff,
            partnerId: user.partnerId,
            managedPartnerIds,
          }
        } catch (error) {
          console.error('[Auth] Error during login:', error)
          return null
        }
      },
    }),
    Google({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    // LinkedIn OpenID Connect — explicit endpoints/scopes avoid flaky discovery
    // and missing-email failures that bounce users back to /login on the first try.
    LinkedIn({
      clientId: process.env.LINKEDIN_ID!,
      clientSecret: process.env.LINKEDIN_SECRET!,
      client: { token_endpoint_auth_method: 'client_secret_post' },
      issuer: 'https://www.linkedin.com/oauth',
      jwks_endpoint: 'https://www.linkedin.com/oauth/openid/jwks',
      authorization: {
        params: { scope: 'openid profile email' },
      },
      token: 'https://www.linkedin.com/oauth/v2/accessToken',
      userinfo: 'https://api.linkedin.com/v2/userinfo',
      checks: ['state'],
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        // For OAuth providers, the user.id is the provider's ID, not our DB ID.
        // Look up the actual database user by email.
        if (account?.provider === 'google' || account?.provider === 'linkedin') {
          const email = user.email?.toLowerCase()
          if (email) {
            const dbUser = await db.query.users.findFirst({
              where: eq(users.email, email),
            })
            if (dbUser) {
              const managedRows = await db
                .select({ partnerId: partnerManagers.partnerId })
                .from(partnerManagers)
                .where(eq(partnerManagers.userId, dbUser.id))
              token.id = dbUser.id.toString()
              token.isAdmin = dbUser.isAdmin
              token.isEditor = dbUser.isEditor
              token.isStaff = dbUser.isStaff
              token.partnerId = dbUser.partnerId
              token.managedPartnerIds = managedRows.map(r => r.partnerId)
              return token
            }
          } else {
            console.error('[Auth] OAuth user missing email:', account.provider)
          }
        }
        // Credentials provider already returns the correct DB id
        token.id = user.id as string
        token.isAdmin = (user as any).isAdmin
        token.isEditor = (user as any).isEditor
        token.isStaff = (user as any).isStaff
        token.partnerId = (user as any).partnerId
        token.managedPartnerIds = (user as any).managedPartnerIds || []
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        // Normal session - impersonation is handled by getEffectiveSession()
        session.user.id = token.id as string
        ;(session.user as any).isAdmin = token.isAdmin
        ;(session.user as any).isEditor = token.isEditor
        ;(session.user as any).isStaff = token.isStaff
        ;(session.user as any).partnerId = token.partnerId
        ;(session.user as any).managedPartnerIds = token.managedPartnerIds || []
      }
      return session
    },
    async signIn({ user, account }) {
      // For OAuth providers, check if user exists or create them
      if (account?.provider === 'google' || account?.provider === 'linkedin') {
        const email = user.email?.toLowerCase()
        if (!email) {
          // LinkedIn occasionally omits email on the first consent response.
          // Rejecting here sends the user back to /login; asking again usually works.
          console.error('[Auth] OAuth signIn blocked — no email from', account.provider)
          return false
        }

        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, email),
        })

        if (!existingUser) {
          if (isBlockedRegistrationEmail(email)) {
            return '/login?error=company_email_required'
          }

          // Check for co-registration partner cookie
          let oauthPartnerId = 1
          let partnerName: string | undefined
          try {
            const cookieStore = await cookies()
            const partnerCookie = cookieStore.get('coregister_partner_id')?.value
            if (partnerCookie) {
              const parsedId = parseInt(partnerCookie, 10)
              if (!isNaN(parsedId)) {
                const partner = await db.query.partners.findFirst({
                  where: and(
                    eq(partners.id, parsedId),
                    eq(partners.isActive, true),
                  ),
                })
                if (partner) {
                  oauthPartnerId = partner.id
                  partnerName = partner.company || partner.brandName || partner.handle || undefined
                }
              }
            }
          } catch {
            // Cookies may not be available in all contexts
          }

          // Create new user from OAuth
          const [newUser] = await db.insert(users).values({
            email,
            emailVerified: true,
            regMethod: account.provider,
            partnerId: oauthPartnerId,
            createdAt: new Date(),
          }).returning()

          if (newUser) {
            const nameParts = (user.name || '').split(' ').filter(Boolean)
            const firstName = nameParts[0] || ''
            const lastName = nameParts.slice(1).join(' ') || ''

            if (user.name) {
              await db.insert(userProfiles).values({
                userId: newUser.id,
                firstName,
                lastName,
              })
            }

            // Add to SalesNexus CRM (non-blocking)
            addContactToSalesNexus({
              email,
              firstName: firstName || undefined,
              lastName: lastName || undefined,
              partner: partnerName,
            })

            // Welcome gift: News Marketing ebook (non-blocking)
            sendNewsMarketingBookEmail(email, firstName || undefined).catch((err) =>
              console.error('Failed to send News Marketing book email:', err)
            )

            // SMS notification (non-blocking)
            sendSmsNotification(
              `New account registered: ${user.name || email} (${email}) via ${account.provider}`
            )
          }
        }
      }
      return true
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
})

/**
 * Get the effective session, accounting for admin impersonation.
 * Use this instead of auth() in API routes and server components
 * when you need to respect impersonation.
 */
export async function getEffectiveSession() {
  const session = await auth()

  if (!session?.user) return null

  // Check for impersonation cookies
  try {
    const cookieStore = await cookies()
    const impersonateUserId = cookieStore.get(IMPERSONATE_COOKIE)?.value
    const adminId = cookieStore.get(IMPERSONATE_ADMIN_COOKIE)?.value

    if (impersonateUserId && adminId && ((session.user as any).isAdmin || (session.user as any).isEditor || (session.user as any).isStaff)) {
      // Fetch impersonated user
      const impersonatedUser = await db.query.users.findFirst({
        where: eq(users.id, parseInt(impersonateUserId)),
      })

      if (impersonatedUser) {
        const profile = await db.query.userProfiles.findFirst({
          where: eq(userProfiles.userId, impersonatedUser.id),
        })

        const managedRows = await db
          .select({ partnerId: partnerManagers.partnerId })
          .from(partnerManagers)
          .where(eq(partnerManagers.userId, impersonatedUser.id))

        // Return session as the impersonated user
        return {
          ...session,
          user: {
            id: impersonatedUser.id.toString(),
            email: impersonatedUser.email,
            name: profile?.firstName
              ? `${profile.firstName} ${profile.lastName || ''}`
              : impersonatedUser.email,
            isAdmin: impersonatedUser.isAdmin,
            isEditor: impersonatedUser.isEditor,
            isStaff: impersonatedUser.isStaff,
            partnerId: impersonatedUser.partnerId,
            managedPartnerIds: managedRows.map(r => r.partnerId),
            isImpersonating: true,
            impersonatedBy: adminId,
          }
        }
      }
    }
  } catch (error) {
    // Cookies not available in this context, return normal session
    console.error('[Auth] Error checking impersonation:', error)
  }

  return session
}
