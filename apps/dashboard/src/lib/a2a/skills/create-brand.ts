import { db } from '@/db'
import { company } from '@/db/schema'
import { v4 as uuidv4 } from 'uuid'
import { generateUniqueNrUri } from '@/lib/newsroom-slug'
import type { Message, SkillResult, AuthContext } from '../types'

interface CreateBrandInput {
  companyName: string
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

function parseInput(message: Message): CreateBrandInput | null {
  for (const part of message.parts) {
    if (part.type === 'data' && part.mimeType === 'application/json') {
      return part.data as unknown as CreateBrandInput
    }
  }
  for (const part of message.parts) {
    if (part.type === 'text') {
      try {
        return JSON.parse(part.text)
      } catch {
        // Try to extract company name from text like "create brand Acme Corp"
        const text = part.text.replace(/^(create|add|new)\s+(brand|company)\s*/i, '').trim()
        if (text) return { companyName: text }
      }
    }
  }
  return null
}

export async function createBrand(message: Message, auth: AuthContext): Promise<SkillResult> {
  const input = parseInput(message)
  if (!input?.companyName) {
    throw new Error('companyName is required')
  }

  const uuid = uuidv4()
  const nrUri = await generateUniqueNrUri(input.companyName)

  const [newCompany] = await db.insert(company).values({
    uuid,
    userId: auth.userId,
    companyName: input.companyName,
    website: input.website,
    city: input.city,
    state: input.state,
    countryCode: input.countryCode,
    addr1: input.addr1,
    addr2: input.addr2,
    postalCode: input.postalCode,
    phone: input.phone,
    email: input.email,
    linkedinUrl: input.linkedinUrl,
    xUrl: input.xUrl,
    youtubeUrl: input.youtubeUrl,
    instagramUrl: input.instagramUrl,
    nrUri,
  }).returning()

  return {
    artifacts: [{
      id: 'created-brand',
      name: `Brand: ${newCompany.companyName}`,
      parts: [
        { type: 'text', text: `Brand "${newCompany.companyName}" created successfully.` },
        {
          type: 'data',
          mimeType: 'application/json',
          data: {
            uuid: newCompany.uuid,
            name: newCompany.companyName,
            newsroomUri: newCompany.nrUri,
          },
        },
      ],
    }],
  }
}
