# Newsworthy OAuth — Client Integration Spec

## Overview

Allow users to log into your application using their Newsworthy account. Uses OAuth 2.0 Authorization Code + PKCE via the Newsworthy OAuth server.

**OAuth Server**: `https://auth.newsworthy.ai` (production) / `http://localhost:3002` (dev)

---

## 1. Register Your Client

Ask a Newsworthy admin to insert a client record:

```sql
INSERT INTO nwai_oauth_clients (
  client_id, client_secret_hash, name,
  redirect_uris, allowed_scopes,
  is_confidential, is_active, skip_consent
) VALUES (
  'nwai_yourappname',                    -- unique client identifier
  '<bcrypt hash of your client secret>', -- generate with: bcryptjs.hash(secret, 10)
  'Your App Name',
  ARRAY['https://yourapp.com/api/auth/callback/newsworthy'],  -- exact callback URL(s)
  ARRAY['openid', 'profile', 'email'],   -- scopes your app needs
  true, true, true
);
```

You'll receive:
- **client_id**: `nwai_yourappname`
- **client_secret**: the unhashed secret (store securely)

---

## 2. NextAuth v5 Integration (Recommended)

### Install

```bash
bun add next-auth
```

### Configure Provider

```typescript
// auth.ts (or lib/auth.ts)
import NextAuth from 'next-auth'

const OAUTH_ISSUER = process.env.OAUTH_ISSUER || 'http://localhost:3002'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    {
      id: 'newsworthy',
      name: 'Newsworthy',
      type: 'oidc',
      issuer: OAUTH_ISSUER,
      clientId: process.env.OAUTH_CLIENT_ID!,
      clientSecret: process.env.OAUTH_CLIENT_SECRET!,
      checks: ['pkce', 'state'],
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        }
      },
    },
  ],
  // Optional: extend session with Newsworthy-specific claims
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        token.sub = profile.sub
        // Available if 'roles' scope was requested:
        token.isAdmin = profile.is_admin
        token.isEditor = profile.is_editor
        // Available if 'company' scope was requested:
        token.companies = profile.companies
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string
      }
      return session
    },
  },
})
```

### Route Handler

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/auth'
export const { GET, POST } = handlers
```

### Environment Variables

```env
OAUTH_ISSUER=http://localhost:3002
OAUTH_CLIENT_ID=nwai_yourappname
OAUTH_CLIENT_SECRET=your-client-secret
```

### Sign In Button

```tsx
import { signIn } from 'next-auth/react'

<button onClick={() => signIn('newsworthy')}>
  Sign in with Newsworthy
</button>
```

---

## 3. Manual Integration (No NextAuth)

If you're not using NextAuth, implement the flow manually:

### Step 1: Redirect to Authorize

Generate PKCE values and redirect:

```typescript
import { randomBytes, createHash } from 'crypto'

// Generate PKCE
const codeVerifier = randomBytes(32).toString('base64url')
const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
const state = randomBytes(16).toString('hex')

// Store codeVerifier and state in session/cookie for later verification

const params = new URLSearchParams({
  client_id: 'nwai_yourappname',
  redirect_uri: 'https://yourapp.com/callback',
  response_type: 'code',
  scope: 'openid profile email',
  state,
  code_challenge: codeChallenge,
  code_challenge_method: 'S256',
})

redirect(`${OAUTH_ISSUER}/authorize?${params}`)
```

### Step 2: Exchange Code for Tokens

After the user authenticates, they're redirected to your `redirect_uri` with `?code=...&state=...`.

```typescript
// Verify state matches what you stored

const response = await fetch(`${OAUTH_ISSUER}/api/token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
  },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: receivedCode,
    redirect_uri: 'https://yourapp.com/callback',
    code_verifier: storedCodeVerifier,
  }),
})

const { access_token, refresh_token, expires_in, scope } = await response.json()
```

### Step 3: Fetch User Info

```typescript
const response = await fetch(`${OAUTH_ISSUER}/api/userinfo`, {
  headers: { 'Authorization': `Bearer ${access_token}` },
})

const user = await response.json()
// { sub: "123", name: "Jane Doe", email: "jane@example.com", ... }
```

### Step 4: Refresh Tokens

Access tokens expire after 1 hour. Use the refresh token to get new ones:

```typescript
const response = await fetch(`${OAUTH_ISSUER}/api/token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
  },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: storedRefreshToken,
  }),
})

const { access_token, refresh_token, expires_in } = await response.json()
// Store the NEW refresh_token — old one is now invalid (single-use rotation)
```

### Step 5: Revoke Tokens (Logout)

```typescript
await fetch(`${OAUTH_ISSUER}/api/revoke`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ token: access_token }),
})
```

---

## 4. Available Scopes & Claims

| Scope | Claims Returned |
|-------|----------------|
| `openid` | `sub` (user ID) |
| `profile` | `name`, `given_name`, `family_name`, `picture` |
| `email` | `email`, `email_verified` |
| `roles` | `is_admin`, `is_editor`, `is_staff` |
| `company` | `companies` array: `[{ id, uuid, name, role }]` |

Request scopes as a space-separated string: `openid profile email`

---

## 5. Discovery Endpoint

Auto-configuration for OIDC-compatible clients:

```
GET /.well-known/openid-configuration
```

Returns all endpoint URLs, supported scopes, and capabilities.

---

## 6. Security Notes

- **PKCE is required** for all clients (S256 only)
- **Redirect URIs** must exactly match a registered URI — no wildcards
- **Refresh tokens are single-use** — always store the new one after rotation
- **Reusing a revoked refresh token** triggers revocation of all tokens for that user+client (theft detection)
- **State parameter** is required to prevent CSRF
- All token exchange happens server-side (`/api/token` should never be called from the browser)

---

## 7. Token Lifetimes

| Token | Lifetime |
|-------|----------|
| Authorization code | 60 seconds |
| Access token | 1 hour |
| Refresh token | 30 days |
| Login session (on OAuth server) | 30 days |
