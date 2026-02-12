import { db } from '@/db'
import { newsDbMaster } from '@/db/schema'
import { ilike, or, desc, and, eq } from 'drizzle-orm'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, User, Mail, Linkedin, Twitter, Plus } from 'lucide-react'
import { NewsDbSearchForm } from './search-form'

interface SearchParams {
  q?: string
  industry?: string
}

async function searchContacts(params: SearchParams) {
  if (!params.q && !params.industry) {
    return []
  }

  const conditions = [eq(newsDbMaster.isValid, true)]

  if (params.q) {
    conditions.push(
      or(
        ilike(newsDbMaster.firstName, `%${params.q}%`),
        ilike(newsDbMaster.lastName, `%${params.q}%`),
        ilike(newsDbMaster.email, `%${params.q}%`),
        ilike(newsDbMaster.tld, `%${params.q}%`)
      ) as any
    )
  }

  if (params.industry) {
    conditions.push(ilike(newsDbMaster.industry, `%${params.industry}%`))
  }

  const results = await db
    .select()
    .from(newsDbMaster)
    .where(and(...conditions))
    .orderBy(desc(newsDbMaster.updatedAt))
    .limit(50)

  return results
}

interface PageProps {
  searchParams: Promise<SearchParams>
}

export default async function NewsDbSearchPage({ searchParams }: PageProps) {
  const params = await searchParams
  const contacts = await searchContacts(params)
  const hasSearched = !!(params.q || params.industry)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/newsdb">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Search Media Database</h1>
          <p className="text-gray-500">Find journalists and media contacts</p>
        </div>
      </div>

      {/* Search Form */}
      <NewsDbSearchForm initialQuery={params.q} initialIndustry={params.industry} />

      {/* Results */}
      {hasSearched && (
        <>
          {contacts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <User className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">No contacts found</h3>
                <p className="mt-2 text-gray-500">Try adjusting your search criteria</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                Found {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-4">
                {contacts.map((contact) => (
                  <Card key={contact.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
                            {contact.firstName?.[0]}{contact.lastName?.[0]}
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">
                              {contact.firstName} {contact.lastName}
                            </h3>
                            {contact.tld && (
                              <p className="text-sm text-gray-500">{contact.tld}</p>
                            )}
                            {contact.industry && (
                              <p className="text-sm text-gray-400">{contact.industry}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2">
                              {contact.email && (
                                <a
                                  href={`mailto:${contact.email}`}
                                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                >
                                  <Mail className="h-3 w-3" />
                                  Email
                                </a>
                              )}
                              {contact.linkedin && (
                                <a
                                  href={contact.linkedin}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                >
                                  <Linkedin className="h-3 w-3" />
                                  LinkedIn
                                </a>
                              )}
                              {contact.twitter && (
                                <a
                                  href={`https://twitter.com/${contact.twitter}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                >
                                  <Twitter className="h-3 w-3" />
                                  Twitter
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-1" />
                          Add to List
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {!hasSearched && (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">Search for contacts</h3>
            <p className="mt-2 text-gray-500">Enter a name, email, or publication to get started</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
