'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { HelpTip } from '@/components/ui/help-tip'
import {
  Copy, Check, Info, Save, RotateCcw, Loader2,
  Globe, Bot, Braces, Shield, Plus, Trash2,
} from 'lucide-react'

interface CompanyData {
  companyName: string
  website: string
  logoUrl: string
  phone: string
  email: string
  addr1: string
  addr2: string
  city: string
  state: string
  postalCode: string
  countryCode: string
  linkedinUrl: string
  xUrl: string
  youtubeUrl: string
  instagramUrl: string
  blogUrl: string
}

interface SeoConfig {
  meta: {
    title: string
    description: string
    ogImage: string
    twitterCardType: string
  }
  aio: {
    preferredName: string
    companySummary: string
    corrections: string
    keyFacts: {
      foundedYear: string
      hqLocation: string
      employeeCount: string
      industry: string
      stockTicker: string
    }
  }
  schemas: {
    localBusiness: {
      enabled: boolean
      latitude: string
      longitude: string
      openingHours: string
      priceRange: string
    }
    person: {
      enabled: boolean
      name: string
      jobTitle: string
      image: string
      sameAs: string[]
    }
    faq: Array<{ question: string; answer: string }>
    breadcrumb: {
      enabled: boolean
    }
  }
  indexing: {
    newsroomRobots: string
    prDefaultRobots: string
  }
}

interface SeoFormProps {
  companyUuid: string
  savedJsonLd: Record<string, unknown> | null
  savedSeo: Record<string, unknown> | null
  companyData: CompanyData
}

function buildJsonLd(data: CompanyData) {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.companyName,
  }

  if (data.website) jsonLd.url = data.website
  if (data.logoUrl) jsonLd.logo = data.logoUrl
  if (data.phone) jsonLd.telephone = data.phone
  if (data.email) jsonLd.email = data.email

  const hasAddress = data.addr1 || data.city || data.state || data.postalCode
  if (hasAddress) {
    const address: Record<string, string> = {
      '@type': 'PostalAddress',
    }
    if (data.addr1) address.streetAddress = data.addr2 ? `${data.addr1}, ${data.addr2}` : data.addr1
    if (data.city) address.addressLocality = data.city
    if (data.state) address.addressRegion = data.state
    if (data.postalCode) address.postalCode = data.postalCode
    if (data.countryCode) address.addressCountry = data.countryCode
    jsonLd.address = address
  }

  const sameAs = [
    data.linkedinUrl,
    data.xUrl,
    data.youtubeUrl,
    data.instagramUrl,
    data.blogUrl,
  ].filter(Boolean)

  if (sameAs.length > 0) jsonLd.sameAs = sameAs

  return jsonLd
}

const defaultSeoConfig: SeoConfig = {
  meta: {
    title: '',
    description: '',
    ogImage: '',
    twitterCardType: 'summary_large_image',
  },
  aio: {
    preferredName: '',
    companySummary: '',
    corrections: '',
    keyFacts: {
      foundedYear: '',
      hqLocation: '',
      employeeCount: '',
      industry: '',
      stockTicker: '',
    },
  },
  schemas: {
    localBusiness: {
      enabled: false,
      latitude: '',
      longitude: '',
      openingHours: '',
      priceRange: '',
    },
    person: {
      enabled: false,
      name: '',
      jobTitle: '',
      image: '',
      sameAs: [],
    },
    faq: [],
    breadcrumb: {
      enabled: false,
    },
  },
  indexing: {
    newsroomRobots: 'index, follow',
    prDefaultRobots: 'index, follow',
  },
}

function mergeSeoConfig(saved: Record<string, unknown> | null): SeoConfig {
  if (!saved) return { ...defaultSeoConfig }

  const s = saved as Partial<SeoConfig>
  return {
    meta: {
      ...defaultSeoConfig.meta,
      ...s.meta,
    },
    aio: {
      ...defaultSeoConfig.aio,
      ...s.aio,
      keyFacts: {
        ...defaultSeoConfig.aio.keyFacts,
        ...(s.aio?.keyFacts || {}),
      },
    },
    schemas: {
      localBusiness: {
        ...defaultSeoConfig.schemas.localBusiness,
        ...(s.schemas?.localBusiness || {}),
      },
      person: {
        ...defaultSeoConfig.schemas.person,
        ...(s.schemas?.person || {}),
        sameAs: s.schemas?.person?.sameAs || [],
      },
      faq: s.schemas?.faq || [],
      breadcrumb: {
        ...defaultSeoConfig.schemas.breadcrumb,
        ...(s.schemas?.breadcrumb || {}),
      },
    },
    indexing: {
      ...defaultSeoConfig.indexing,
      ...s.indexing,
    },
  }
}

export function SeoForm({ companyUuid, savedJsonLd, savedSeo, companyData }: SeoFormProps) {
  const router = useRouter()
  const autoGenerated = useMemo(() => buildJsonLd(companyData), [companyData])

  const initialText = savedJsonLd
    ? JSON.stringify(savedJsonLd, null, 2)
    : JSON.stringify(autoGenerated, null, 2)

  const [jsonLdText, setJsonLdText] = useState(initialText)
  const [copied, setCopied] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [config, setConfig] = useState<SeoConfig>(() => mergeSeoConfig(savedSeo))

  // Helper to update nested config
  function updateMeta<K extends keyof SeoConfig['meta']>(key: K, value: SeoConfig['meta'][K]) {
    setConfig(prev => ({ ...prev, meta: { ...prev.meta, [key]: value } }))
  }

  function updateAio<K extends keyof SeoConfig['aio']>(key: K, value: SeoConfig['aio'][K]) {
    setConfig(prev => ({ ...prev, aio: { ...prev.aio, [key]: value } }))
  }

  function updateKeyFact<K extends keyof SeoConfig['aio']['keyFacts']>(key: K, value: string) {
    setConfig(prev => ({
      ...prev,
      aio: {
        ...prev.aio,
        keyFacts: { ...prev.aio.keyFacts, [key]: value },
      },
    }))
  }

  function updateLocalBusiness<K extends keyof SeoConfig['schemas']['localBusiness']>(key: K, value: SeoConfig['schemas']['localBusiness'][K]) {
    setConfig(prev => ({
      ...prev,
      schemas: {
        ...prev.schemas,
        localBusiness: { ...prev.schemas.localBusiness, [key]: value },
      },
    }))
  }

  function updatePerson<K extends keyof SeoConfig['schemas']['person']>(key: K, value: SeoConfig['schemas']['person'][K]) {
    setConfig(prev => ({
      ...prev,
      schemas: {
        ...prev.schemas,
        person: { ...prev.schemas.person, [key]: value },
      },
    }))
  }

  function updatePersonSameAs(index: number, value: string) {
    setConfig(prev => {
      const sameAs = [...prev.schemas.person.sameAs]
      sameAs[index] = value
      return {
        ...prev,
        schemas: {
          ...prev.schemas,
          person: { ...prev.schemas.person, sameAs },
        },
      }
    })
  }

  function addPersonSameAs() {
    setConfig(prev => ({
      ...prev,
      schemas: {
        ...prev.schemas,
        person: { ...prev.schemas.person, sameAs: [...prev.schemas.person.sameAs, ''] },
      },
    }))
  }

  function removePersonSameAs(index: number) {
    setConfig(prev => ({
      ...prev,
      schemas: {
        ...prev.schemas,
        person: {
          ...prev.schemas.person,
          sameAs: prev.schemas.person.sameAs.filter((_, i) => i !== index),
        },
      },
    }))
  }

  function updateFaq(index: number, field: 'question' | 'answer', value: string) {
    setConfig(prev => {
      const faq = [...prev.schemas.faq]
      faq[index] = { ...faq[index], [field]: value }
      return {
        ...prev,
        schemas: { ...prev.schemas, faq },
      }
    })
  }

  function addFaq() {
    setConfig(prev => ({
      ...prev,
      schemas: {
        ...prev.schemas,
        faq: [...prev.schemas.faq, { question: '', answer: '' }],
      },
    }))
  }

  function removeFaq(index: number) {
    setConfig(prev => ({
      ...prev,
      schemas: {
        ...prev.schemas,
        faq: prev.schemas.faq.filter((_, i) => i !== index),
      },
    }))
  }

  function updateBreadcrumb(enabled: boolean) {
    setConfig(prev => ({
      ...prev,
      schemas: {
        ...prev.schemas,
        breadcrumb: { enabled },
      },
    }))
  }

  function updateIndexing<K extends keyof SeoConfig['indexing']>(key: K, value: string) {
    setConfig(prev => ({ ...prev, indexing: { ...prev.indexing, [key]: value } }))
  }

  async function handleSave() {
    setError(null)
    setSuccess(null)

    // Validate JSON-LD
    let parsedJsonLd: unknown
    try {
      parsedJsonLd = JSON.parse(jsonLdText)
    } catch (e) {
      const msg = e instanceof SyntaxError ? e.message : 'Invalid JSON'
      setError(`JSON syntax error: ${msg}`)
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/company/${companyUuid}/seo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonLd: parsedJsonLd, seo: config }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      setJsonLdText(JSON.stringify(parsedJsonLd, null, 2))
      setSuccess('SEO settings saved successfully.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  function handleReset() {
    setJsonLdText(JSON.stringify(autoGenerated, null, 2))
    setError(null)
    setSuccess(null)
  }

  async function handleCopy() {
    const scriptBlock = `<script type="application/ld+json">\n${jsonLdText}\n</script>`
    await navigator.clipboard.writeText(scriptBlock)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const robotsOptions = [
    'index, follow',
    'noindex, follow',
    'index, nofollow',
    'noindex, nofollow',
  ]

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">{error}</div>
      )}
      {success && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-lg">{success}</div>
      )}

      <div className="flex items-start gap-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <Info className="h-5 w-5 mt-0.5 text-amber-500 flex-shrink-0" />
        <p>
          <strong>SEO &amp; AI: Get the most out of your news marketing efforts.</strong> This section is optional, however spending some time on this page will boost your SEO and AI visibility. You will get out of it what you put into it.
        </p>
      </div>

      {/* Organization JSON-LD Card */}
      <Card>
        <CardHeader>
          <CardTitle>Organization JSON-LD</CardTitle>
          <CardDescription>
            Structured data markup for your organization. Edit the JSON below, then
            copy the snippet into your website&apos;s <code className="text-sm bg-gray-100 px-1 py-0.5 rounded">&lt;head&gt;</code> tag
            to help search engines and AI models understand your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={jsonLdText}
            onChange={(e) => setJsonLdText(e.target.value)}
            rows={20}
            className="font-mono text-sm leading-relaxed"
            placeholder='{"@context": "https://schema.org", "@type": "Organization", ...}'
          />

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Snippet
                </>
              )}
            </Button>

            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              Reset to Auto-Generated
            </Button>
          </div>

          <div className="flex items-start gap-2 text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-3">
            <Info className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
            <p>
              <strong className="text-gray-700">What is JSON-LD?</strong> JSON-LD is a structured data format used by
              Google, Bing, and AI tools to understand your organization. We will include this
              in your press release page HTML to improve search visibility and AI-generated answers about your brand.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Newsroom Meta Defaults Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-gray-500" />
            <CardTitle>Newsroom Meta Defaults</CardTitle>
          </div>
          <CardDescription>
            Default meta tags applied to your newsroom pages. These can be overridden per page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="meta-title">Meta Title</Label>
              <HelpTip
                title="Meta Title"
                content="The default <title> tag for your newsroom pages. This appears as the clickable headline in Google search results and browser tabs. Keep it under 60 characters to avoid truncation. Include your company name and a keyword like 'Newsroom' or 'Press Room' to improve discoverability."
              />
            </div>
            <Input
              id="meta-title"
              value={config.meta.title}
              onChange={(e) => updateMeta('title', e.target.value)}
              placeholder={`${companyData.companyName} | Newsroom`}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="meta-description">Meta Description</Label>
              <HelpTip
                title="Meta Description"
                content="The default meta description for your newsroom. This appears as the snippet text below your title in search results. Keep it between 120-160 characters for best display. Write a compelling summary that includes relevant keywords and encourages clicks. Google may override this with page content it deems more relevant."
              />
            </div>
            <Textarea
              id="meta-description"
              value={config.meta.description}
              onChange={(e) => updateMeta('description', e.target.value)}
              rows={3}
              placeholder="A brief description of your newsroom for search engine results..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="og-image">OG Image URL</Label>
              <HelpTip
                title="OG Image URL"
                content="The Open Graph image displayed when your newsroom is shared on social media (Facebook, LinkedIn, Slack, etc.). Use an image at least 1200x630 pixels for best results. This should be a direct URL to the image file (JPG or PNG). If left blank, social platforms may pick a random image from the page or show no preview."
              />
            </div>
            <Input
              id="og-image"
              type="url"
              value={config.meta.ogImage}
              onChange={(e) => updateMeta('ogImage', e.target.value)}
              placeholder="https://example.com/og-image.jpg"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="twitter-card">Twitter Card Type</Label>
              <HelpTip
                title="Twitter Card Type"
                content="Controls how your links appear when shared on X (Twitter). 'Summary' shows a small square thumbnail beside the title and description. 'Summary with Large Image' shows a large image above the text, which gets significantly more engagement. Use 'Summary with Large Image' if you have a high-quality OG image set above."
              />
            </div>
            <Select
              id="twitter-card"
              value={config.meta.twitterCardType}
              onChange={(e) => updateMeta('twitterCardType', e.target.value)}
            >
              <option value="summary">Summary</option>
              <option value="summary_large_image">Summary with Large Image</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* AI/LLM Optimization Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-gray-500" />
            <CardTitle>AI/LLM Optimization</CardTitle>
          </div>
          <CardDescription>
            Help AI models like ChatGPT, Gemini, and Claude provide accurate information about your company.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="preferred-name">Preferred Company Name</Label>
              <HelpTip
                title="Preferred Company Name"
                content="The exact name AI models should use when referring to your company. This is critical for brand accuracy. For example, if your legal name is 'Acme Corp.' but you go by 'ACME', enter 'ACME' here. AI models will use this as the canonical spelling. Include any special capitalization, punctuation, or spacing that matters to your brand identity."
              />
            </div>
            <Input
              id="preferred-name"
              value={config.aio.preferredName}
              onChange={(e) => updateAio('preferredName', e.target.value)}
              placeholder={companyData.companyName}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="company-summary">Company Summary</Label>
              <HelpTip
                title="Company Summary"
                content="A factual, plain-text description of your company written specifically for AI consumption. This text is embedded in your newsroom's metadata and used by LLMs (ChatGPT, Gemini, Claude, etc.) to generate accurate responses about your company.

Best practices:
- Write in third person ('Acme provides...' not 'We provide...')
- State what the company does, who it serves, and where it operates
- Include key differentiators and market position
- Avoid superlatives and marketing buzzwords like 'world-class' or 'cutting-edge'
- Keep it between 150-300 words for optimal AI indexing
- Update it when major company changes occur (new products, acquisitions, pivots)"
              />
            </div>
            <Textarea
              id="company-summary"
              value={config.aio.companySummary}
              onChange={(e) => updateAio('companySummary', e.target.value)}
              rows={5}
              placeholder="Write a factual, plain-text summary of your company for AI consumption..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="corrections">Corrections / Clarifications</Label>
              <HelpTip
                title="Corrections / Clarifications"
                content="Use this field to correct common misconceptions that AI models have about your company. AI models are trained on internet data and may have outdated or inaccurate information.

Examples:
- 'Acme was acquired by BigCorp in 2024, but continues to operate as an independent subsidiary.'
- 'Acme is NOT affiliated with Acme Industries, which is a separate company.'
- 'Our headquarters moved from NYC to Austin, TX in 2023.'
- 'Our CEO is Jane Smith (appointed 2024), not John Doe who retired.'

Write each correction as a clear, declarative statement. This text is embedded in structured data that AI crawlers can reference."
              />
            </div>
            <Textarea
              id="corrections"
              value={config.aio.corrections}
              onChange={(e) => updateAio('corrections', e.target.value)}
              rows={3}
              placeholder="Statements AI models often get wrong about your brand..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Key Facts</Label>
              <HelpTip
                title="Key Facts"
                content="Structured factual data about your company that AI models and search engines can reference. These fields are embedded as schema.org properties and llms.txt metadata.

These facts help AI models answer specific questions like 'When was [company] founded?' or 'How many employees does [company] have?' with verified data directly from your company rather than relying on potentially outdated web sources."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="founded-year" className="text-xs text-gray-500">Founded Year</Label>
                  <HelpTip
                    title="Founded Year"
                    content="The year your company was founded or incorporated. This is one of the most commonly asked facts about companies. Use the four-digit year (e.g., '2015'). If your company was founded as a different entity and later renamed or restructured, use the original founding year."
                  />
                </div>
                <Input
                  id="founded-year"
                  value={config.aio.keyFacts.foundedYear}
                  onChange={(e) => updateKeyFact('foundedYear', e.target.value)}
                  placeholder="2020"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="hq-location" className="text-xs text-gray-500">HQ Location</Label>
                  <HelpTip
                    title="HQ Location"
                    content="Your company's primary headquarters location. Use the format 'City, State' for US companies or 'City, Country' for international companies. Examples: 'San Francisco, CA', 'London, UK', 'Toronto, Canada'. If you have multiple headquarters, list the primary one here."
                  />
                </div>
                <Input
                  id="hq-location"
                  value={config.aio.keyFacts.hqLocation}
                  onChange={(e) => updateKeyFact('hqLocation', e.target.value)}
                  placeholder="San Francisco, CA"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="employee-count" className="text-xs text-gray-500">Employee Count</Label>
                  <HelpTip
                    title="Employee Count"
                    content="Your approximate number of employees. You can use exact numbers ('1,250') or ranges ('1,000-5,000'). Common range formats: '1-10', '11-50', '51-200', '201-500', '501-1,000', '1,001-5,000', '5,001-10,000', '10,000+'. Update this when headcount changes significantly."
                  />
                </div>
                <Input
                  id="employee-count"
                  value={config.aio.keyFacts.employeeCount}
                  onChange={(e) => updateKeyFact('employeeCount', e.target.value)}
                  placeholder="50-100"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="industry" className="text-xs text-gray-500">Industry</Label>
                  <HelpTip
                    title="Industry"
                    content="Your company's primary industry or sector. Be specific enough to be useful but broad enough to be accurate. Examples: 'Enterprise SaaS', 'Healthcare Technology', 'Financial Services', 'E-commerce', 'Clean Energy', 'Cybersecurity'. You can list multiple if needed, separated by commas."
                  />
                </div>
                <Input
                  id="industry"
                  value={config.aio.keyFacts.industry}
                  onChange={(e) => updateKeyFact('industry', e.target.value)}
                  placeholder="Technology"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="stock-ticker" className="text-xs text-gray-500">Stock Ticker (optional)</Label>
                  <HelpTip
                    title="Stock Ticker"
                    content="Your company's stock exchange and ticker symbol, if publicly traded. Use the format 'EXCHANGE: TICKER' (e.g., 'NASDAQ: AAPL', 'NYSE: GS', 'LSE: BP'). Leave blank if your company is private. This helps AI models and search engines link financial data to your company."
                  />
                </div>
                <Input
                  id="stock-ticker"
                  value={config.aio.keyFacts.stockTicker}
                  onChange={(e) => updateKeyFact('stockTicker', e.target.value)}
                  placeholder="NASDAQ: ACME"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Schema Markup Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Braces className="h-5 w-5 text-gray-500" />
            <CardTitle>Additional Schema Markup</CardTitle>
          </div>
          <CardDescription>
            Enable additional structured data types to improve search engine understanding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* LocalBusiness Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="local-business-enabled"
                checked={config.schemas.localBusiness.enabled}
                onCheckedChange={(checked) => updateLocalBusiness('enabled', checked === true)}
              />
              <Label htmlFor="local-business-enabled" className="font-medium">LocalBusiness Schema</Label>
              <HelpTip
                title="LocalBusiness Schema"
                content="Adds schema.org/LocalBusiness structured data to your newsroom. This is especially useful if your company has a physical location that customers visit (retail stores, restaurants, offices with walk-in service, etc.).

This schema helps your business appear in Google's local search results, Maps, and the Knowledge Panel. It complements your Google Business Profile. If your company is purely online with no physical customer-facing location, you can leave this disabled."
              />
            </div>

            {config.schemas.localBusiness.enabled && (
              <div className="ml-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="latitude" className="text-xs text-gray-500">Latitude</Label>
                    <HelpTip
                      title="Latitude"
                      content="The geographic latitude of your business location in decimal degrees. Example: 37.7749 for San Francisco. You can find this by searching your address on Google Maps, right-clicking on the pin, and copying the first number from the coordinates shown."
                    />
                  </div>
                  <Input
                    id="latitude"
                    value={config.schemas.localBusiness.latitude}
                    onChange={(e) => updateLocalBusiness('latitude', e.target.value)}
                    placeholder="37.7749"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="longitude" className="text-xs text-gray-500">Longitude</Label>
                    <HelpTip
                      title="Longitude"
                      content="The geographic longitude of your business location in decimal degrees. Example: -122.4194 for San Francisco. This is the second number shown when you right-click a location on Google Maps. Western hemisphere longitudes are negative."
                    />
                  </div>
                  <Input
                    id="longitude"
                    value={config.schemas.localBusiness.longitude}
                    onChange={(e) => updateLocalBusiness('longitude', e.target.value)}
                    placeholder="-122.4194"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="opening-hours" className="text-xs text-gray-500">Opening Hours</Label>
                    <HelpTip
                      title="Opening Hours"
                      content="Your business hours in schema.org format. Use two-letter day abbreviations (Mo, Tu, We, Th, Fr, Sa, Su) followed by the time range in 24-hour format.

Examples:
- 'Mo-Fr 09:00-17:00' (weekdays 9am-5pm)
- 'Mo-Sa 08:00-20:00' (Mon-Sat 8am-8pm)
- 'Mo-Fr 09:00-17:00, Sa 10:00-14:00' (weekdays + Saturday morning)

Use commas to separate multiple schedules."
                    />
                  </div>
                  <Input
                    id="opening-hours"
                    value={config.schemas.localBusiness.openingHours}
                    onChange={(e) => updateLocalBusiness('openingHours', e.target.value)}
                    placeholder="Mo-Fr 09:00-17:00"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="price-range" className="text-xs text-gray-500">Price Range</Label>
                    <HelpTip
                      title="Price Range"
                      content="An approximate price range for your products or services using dollar signs. This appears in Google search results and Knowledge Panels.

- '$' = Budget / Inexpensive
- '$$' = Moderate
- '$$$' = Expensive
- '$$$$' = Very Expensive

You can also use a specific range like '$10-$50' if that better describes your pricing."
                    />
                  </div>
                  <Input
                    id="price-range"
                    value={config.schemas.localBusiness.priceRange}
                    onChange={(e) => updateLocalBusiness('priceRange', e.target.value)}
                    placeholder="$$"
                  />
                </div>
              </div>
            )}
          </div>

          <hr className="border-gray-200" />

          {/* Spokesperson / CEO Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="person-enabled"
                checked={config.schemas.person.enabled}
                onCheckedChange={(checked) => updatePerson('enabled', checked === true)}
              />
              <Label htmlFor="person-enabled" className="font-medium">Spokesperson / CEO</Label>
              <HelpTip
                title="Spokesperson / CEO"
                content="Adds a schema.org/Person markup for your company's primary spokesperson, CEO, or founder. This helps search engines and AI models connect a key person to your organization.

When enabled, Google may show this person in your company's Knowledge Panel and in 'People also search for' results. It also helps AI models accurately answer questions like 'Who is the CEO of [company]?'.

This should be someone who publicly represents the company — typically the CEO, founder, or official spokesperson."
              />
            </div>

            {config.schemas.person.enabled && (
              <div className="ml-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="person-name" className="text-xs text-gray-500">Name</Label>
                      <HelpTip
                        title="Person Name"
                        content="The full name of your company's spokesperson or CEO as it should appear in search results. Use the name they are publicly known by (e.g., 'Tim Cook' not 'Timothy Donald Cook'). This should match how the person is referenced in press releases and media."
                      />
                    </div>
                    <Input
                      id="person-name"
                      value={config.schemas.person.name}
                      onChange={(e) => updatePerson('name', e.target.value)}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="person-title" className="text-xs text-gray-500">Job Title</Label>
                      <HelpTip
                        title="Job Title"
                        content="The person's official job title at your company. Use the full title (e.g., 'Chief Executive Officer' rather than 'CEO'). This appears in schema markup and may be displayed in Google Knowledge Panels."
                      />
                    </div>
                    <Input
                      id="person-title"
                      value={config.schemas.person.jobTitle}
                      onChange={(e) => updatePerson('jobTitle', e.target.value)}
                      placeholder="Chief Executive Officer"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="person-image" className="text-xs text-gray-500">Image URL</Label>
                    <HelpTip
                      title="Person Image URL"
                      content="A direct URL to a professional headshot of this person. This image may be used in search engine Knowledge Panels and rich results. Use a high-quality photo (at least 400x400 pixels, square crop preferred). The image should be hosted on your domain or a reliable CDN."
                    />
                  </div>
                  <Input
                    id="person-image"
                    type="url"
                    value={config.schemas.person.image}
                    onChange={(e) => updatePerson('image', e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-gray-500">Social Profile URLs</Label>
                    <HelpTip
                      title="Social Profile URLs"
                      content="Links to this person's official social media profiles. These are used in the schema.org 'sameAs' property to help search engines verify and connect the person's identity across platforms.

Add URLs for profiles like:
- LinkedIn (https://linkedin.com/in/...)
- X / Twitter (https://x.com/...)
- Personal website or blog
- Crunchbase profile
- Wikipedia page (if they have one)

Only add profiles that are actively maintained and publicly represent this person in their professional capacity."
                    />
                  </div>
                  {config.schemas.person.sameAs.map((url, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={url}
                        onChange={(e) => updatePersonSameAs(index, e.target.value)}
                        placeholder="https://linkedin.com/in/..."
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removePersonSameAs(index)}
                        className="flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPersonSameAs}
                  >
                    <Plus className="h-4 w-4" />
                    Add URL
                  </Button>
                </div>
              </div>
            )}
          </div>

          <hr className="border-gray-200" />

          {/* FAQ Schema Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="font-medium">FAQ Schema</Label>
                <HelpTip
                  title="FAQ Schema"
                  content="Adds schema.org/FAQPage structured data to your newsroom. When implemented, your FAQ answers can appear directly in Google search results as expandable rich snippets, significantly increasing your search visibility and click-through rates.

Best practices:
- Add questions that people actually search for about your company
- Write answers in complete sentences (2-3 sentences ideal)
- Don't duplicate questions that are better answered by other schema types
- Include questions about your products, services, policies, and company background
- Google may display up to 2-3 FAQ items directly in search results
- AI models also use FAQ schema to source answers about your company"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addFaq}
              >
                <Plus className="h-4 w-4" />
                Add Question
              </Button>
            </div>

            {config.schemas.faq.length === 0 && (
              <p className="text-sm text-gray-500">No FAQ items added yet. Click &quot;Add Question&quot; to start.</p>
            )}

            {config.schemas.faq.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Question {index + 1}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeFaq(index)}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={item.question}
                  onChange={(e) => updateFaq(index, 'question', e.target.value)}
                  placeholder="What does your company do?"
                />
                <Textarea
                  value={item.answer}
                  onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                  rows={2}
                  placeholder="Write a clear, concise answer..."
                />
              </div>
            ))}
          </div>

          <hr className="border-gray-200" />

          {/* BreadcrumbList Section */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="breadcrumb-enabled"
              checked={config.schemas.breadcrumb.enabled}
              onCheckedChange={(checked) => updateBreadcrumb(checked === true)}
            />
            <div className="flex items-center gap-2">
              <div>
                <Label htmlFor="breadcrumb-enabled" className="font-medium">BreadcrumbList Schema</Label>
                <p className="text-xs text-gray-500">Auto-generated from your newsroom structure.</p>
              </div>
              <HelpTip
                title="BreadcrumbList Schema"
                content="Adds schema.org/BreadcrumbList structured data to your newsroom pages. Breadcrumbs show the page hierarchy in search results (e.g., 'Home > Newsroom > Press Releases > Article Title') instead of displaying the raw URL.

Benefits:
- Improves how your pages appear in search results
- Helps search engines understand your site structure
- Increases click-through rates by showing clear navigation context
- Breadcrumbs are automatically generated from your newsroom's URL structure — no manual configuration needed

This is recommended for all newsrooms and has no downside."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Indexing Controls Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-gray-500" />
            <CardTitle>Indexing Controls</CardTitle>
          </div>
          <CardDescription>
            Control how search engines index your newsroom and press releases.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="newsroom-robots">Newsroom Robots Meta (Recommended: index, follow)</Label>
              <HelpTip
                title="Newsroom Robots Meta"
                content="Controls the robots meta tag for your main newsroom pages (homepage, category pages, archive pages). This tells search engine crawlers whether to index the page and follow its links.

Options:
- 'index, follow' (Recommended) — Search engines will index the page and follow all links. Best for maximum visibility.
- 'noindex, follow' — Page won't appear in search results, but search engines will still follow links to discover your press releases.
- 'index, nofollow' — Page appears in search results, but links on it won't pass SEO value. Rarely useful.
- 'noindex, nofollow' — Page is completely hidden from search engines. Use only if you want a fully private newsroom."
              />
            </div>
            <Select
              id="newsroom-robots"
              value={config.indexing.newsroomRobots}
              onChange={(e) => updateIndexing('newsroomRobots', e.target.value)}
            >
              {robotsOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="pr-robots">Press Release Default Robots (Recommended: index, follow)</Label>
              <HelpTip
                title="Press Release Default Robots"
                content="Controls the default robots meta tag for individual press release pages. This setting applies to all new press releases unless overridden per release.

Options:
- 'index, follow' (Recommended) — Press releases appear in search results and links within them pass SEO value. Best for public press releases.
- 'noindex, follow' — Press releases won't appear in search results directly, but links within them are still followed. Useful for embargoed or internal-only releases.
- 'index, nofollow' — Press releases appear in search but links don't pass value. Rarely needed.
- 'noindex, nofollow' — Completely hidden from search engines. Use for confidential releases.

Individual press releases can override this default in their own settings."
              />
            </div>
            <Select
              id="pr-robots"
              value={config.indexing.prDefaultRobots}
              onChange={(e) => updateIndexing('prDefaultRobots', e.target.value)}
            >
              {robotsOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save All Settings
        </Button>
      </div>
    </div>
  )
}
