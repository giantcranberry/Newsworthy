import { db } from '@/db'
import { company } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { Message, SkillResult, AuthContext } from '../types'

interface UpdateBrandInput {
  companyName?: string
  website?: string
  city?: string
  state?: string
  countryCode?: string
  addr1?: string
  addr2?: string
  postalCode?: string
  phone?: string
  email?: string
  linkedinUrl?: string
  xUrl?: string
  youtubeUrl?: string
  instagramUrl?: string
}

function parseInput(message: Message): UpdateBrandInput {
  for (const part of message.parts) {
    if (part.type === 'data' && part.mimeType === 'application/json') {
      return part.data as unknown as UpdateBrandInput
    }
  }
  for (const part of message.parts) {
    if (part.type === 'text') {
      try {
        return JSON.parse(part.text)
      } catch {
        // Can't infer structured update from plain text
      }
    }
  }
  return {}
}

export async function updateBrand(message: Message, auth: AuthContext): Promise<SkillResult> {
  const input = parseInput(message)

  // Find the brand associated with this API key
  const existingCompany = await db.query.company.findFirst({
    where: eq(company.id, auth.companyId),
  })

  if (!existingCompany) {
    throw new Error('Brand not found')
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {}
  if (input.companyName !== undefined) updates.companyName = input.companyName
  if (input.website !== undefined) updates.website = input.website
  if (input.city !== undefined) updates.city = input.city
  if (input.state !== undefined) updates.state = input.state
  if (input.countryCode !== undefined) updates.countryCode = input.countryCode
  if (input.addr1 !== undefined) updates.addr1 = input.addr1
  if (input.addr2 !== undefined) updates.addr2 = input.addr2
  if (input.postalCode !== undefined) updates.postalCode = input.postalCode
  if (input.phone !== undefined) updates.phone = input.phone
  if (input.email !== undefined) updates.email = input.email
  if (input.linkedinUrl !== undefined) updates.linkedinUrl = input.linkedinUrl
  if (input.xUrl !== undefined) updates.xUrl = input.xUrl
  if (input.youtubeUrl !== undefined) updates.youtubeUrl = input.youtubeUrl
  if (input.instagramUrl !== undefined) updates.instagramUrl = input.instagramUrl

  if (Object.keys(updates).length === 0) {
    throw new Error('No fields provided to update')
  }

  await db.update(company)
    .set(updates)
    .where(eq(company.id, auth.companyId))

  // Fetch updated brand
  const updated = await db.query.company.findFirst({
    where: eq(company.id, auth.companyId),
  })

  return {
    artifacts: [{
      id: 'updated-brand',
      name: `Brand: ${updated?.companyName}`,
      parts: [
        { type: 'text', text: `Brand "${updated?.companyName}" updated successfully.` },
        {
          type: 'data',
          mimeType: 'application/json',
          data: {
            uuid: updated?.uuid,
            name: updated?.companyName,
            newsroomUri: updated?.nrUri,
            website: updated?.website,
            location: [updated?.city, updated?.state, updated?.countryCode].filter(Boolean).join(', '),
          },
        },
      ],
    }],
  }
}
