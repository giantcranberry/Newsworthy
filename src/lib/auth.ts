import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import LinkedIn from 'next-auth/providers/linkedin'
import { compare } from 'bcryptjs'
import { pbkdf2Sync } from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { users, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

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
    }),
    LinkedIn({
      clientId: process.env.LINKEDIN_ID!,
      clientSecret: process.env.LINKEDIN_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.isAdmin = (user as any).isAdmin
        token.isEditor = (user as any).isEditor
        token.isStaff = (user as any).isStaff
        token.partnerId = (user as any).partnerId
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
      }
      return session
    },
    async signIn({ user, account }) {
      // For OAuth providers, check if user exists or create them
      if (account?.provider === 'google' || account?.provider === 'linkedin') {
        const email = user.email?.toLowerCase()
        if (!email) return false

        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, email),
        })

        if (!existingUser) {
          // Create new user from OAuth
          const [newUser] = await db.insert(users).values({
            email,
            emailVerified: true,
            regMethod: account.provider,
            partnerId: 1,
          }).returning()

          if (newUser && user.name) {
            const nameParts = user.name.split(' ')
            await db.insert(userProfiles).values({
              userId: newUser.id,
              firstName: nameParts[0] || '',
              lastName: nameParts.slice(1).join(' ') || '',
            })
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

    if (impersonateUserId && adminId && (session.user as any).isAdmin) {
      // Fetch impersonated user
      const impersonatedUser = await db.query.users.findFirst({
        where: eq(users.id, parseInt(impersonateUserId)),
      })

      if (impersonatedUser) {
        const profile = await db.query.userProfiles.findFirst({
          where: eq(userProfiles.userId, impersonatedUser.id),
        })

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
