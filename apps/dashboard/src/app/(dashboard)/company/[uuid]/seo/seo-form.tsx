'use client'

import { useMemo, useState, useRef, useCallback } from 'react'
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
  Copy, Check, Info, Save, Loader2, ChevronDown,
  Globe, Bot, Braces, Plus, Trash2, Camera, Sparkles, BarChart3,
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { buildJsonLd, type JsonLdCompanyData } from '@/lib/build-json-ld'

interface CompanyData extends JsonLdCompanyData {
  nrUri: string
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
  tracking: {
    gtmId: string
    googleAdsId: string
    metaPixelId: string
    redditPixelId: string
    clarityId: string
    hubspotId: string
  }
}

interface SeoFormProps {
  readOnly?: boolean
  companyUuid: string
  savedSeo: Record<string, unknown> | null
  companyData: CompanyData
}

function buildArticlePreviewJsonLd(data: CompanyData, companyUuid: string) {
  // Build the author Organization exactly as the live press release page does
  const jsonLdAuthor: Record<string, unknown> = {
    '@type': 'Organization',
    name: data.companyName,
    url: `https://www.newsworthy.ai/newsroom/${data.nrUri || companyUuid}`,
  }

  if (data.logoUrl) jsonLdAuthor.logo = data.logoUrl

  const sameAs = [
    data.website,
    data.linkedinUrl,
    data.xUrl,
    data.youtubeUrl,
    data.instagramUrl,
    data.blogUrl,
  ].filter(Boolean)
  if (sameAs.length > 0) jsonLdAuthor.sameAs = sameAs

  jsonLdAuthor.contactPoint = {
    '@type': 'ContactPoint',
    contactType: 'Media Contact',
    telephone: '[PR contact phone will be placed here]',
    email: '[PR contact email will be placed here]',
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': '[article URL will be placed here]',
    },
    headline: '[article headline will be placed here]',
    description: '[article abstract will be placed here]',
    image: {
      '@type': 'ImageObject',
      url: '[article banner image URL will be placed here]',
      width: 1200,
      height: 630,
    },
    datePublished: '[article publication date will be placed here]',
    dateModified: '[article publication date will be placed here]',
    isAccessibleForFree: 'true',
    author: jsonLdAuthor,
    publisher: {
      '@type': 'Organization',
      name: 'Newsworthy.ai',
      url: 'https://www.newsworthy.ai',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.newsworthy.ai/logo.svg',
        width: 256,
        height: 40,
      },
    },
    copyrightHolder: {
      '@type': 'Organization',
      name: data.companyName,
    },
    articleBody: '[article full text will be placed here]',
  }
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
  tracking: {
    gtmId: '',
    googleAdsId: '',
    metaPixelId: '',
    redditPixelId: '',
    clarityId: '',
    hubspotId: '',
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
    tracking: {
      ...defaultSeoConfig.tracking,
      ...s.tracking,
    },
  }
}

export function SeoForm({ readOnly, companyUuid, savedSeo, companyData }: SeoFormProps) {
  const router = useRouter()
  const autoGenerated = useMemo(() => buildJsonLd(companyData), [companyData])
  const articlePreview = useMemo(() => buildArticlePreviewJsonLd(companyData, companyUuid), [companyData, companyUuid])

  const jsonLdText = JSON.stringify(autoGenerated, null, 2)
  const articlePreviewText = JSON.stringify(articlePreview, null, 2)
  const [copied, setCopied] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [config, setConfig] = useState<SeoConfig>(() => mergeSeoConfig(savedSeo))
  const [isUploadingHeadshot, setIsUploadingHeadshot] = useState(false)
  const [isPrefilling, setIsPrefilling] = useState(false)
  const [prefillWebsite, setPrefillWebsite] = useState('')
  const headshotInputRef = useRef<HTMLInputElement>(null)

  const handleHeadshotUpload = useCallback(async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5MB')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only PNG, JPG, and WebP files are supported')
      return
    }

    setIsUploadingHeadshot(true)
    setError(null)

    try {
      const fd = new FormData()
      fd.append('headshot', file)
      fd.append('oldUrl', config.schemas.person.image)

      const response = await fetch(`/api/company/${companyUuid}/seo/headshot`, {
        method: 'POST',
        body: fd,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload photo')
      }

      const data = await response.json()
      updatePerson('image', data.imageUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploadingHeadshot(false)
    }
  }, [companyUuid, config.schemas.person.image])

  const handlePrefill = useCallback(async () => {
    setIsPrefilling(true)
    setError(null)

    try {
      const body: Record<string, string> = {}
      if (!companyData.website && prefillWebsite) {
        body.website = prefillWebsite
      }

      const response = await fetch(`/api/company/${companyUuid}/seo/prefill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate suggestions')
      }

      const result = await response.json()

      setConfig(prev => ({
        ...prev,
        meta: {
          ...prev.meta,
          title: result.meta?.title || prev.meta.title,
          description: result.meta?.description || prev.meta.description,
        },
        aio: {
          ...prev.aio,
          preferredName: result.aio?.preferredName || prev.aio.preferredName,
          companySummary: result.aio?.companySummary || prev.aio.companySummary,
          keyFacts: {
            ...prev.aio.keyFacts,
            foundedYear: result.aio?.keyFacts?.foundedYear || prev.aio.keyFacts.foundedYear,
            hqLocation: result.aio?.keyFacts?.hqLocation || prev.aio.keyFacts.hqLocation,
            employeeCount: result.aio?.keyFacts?.employeeCount || prev.aio.keyFacts.employeeCount,
            industry: result.aio?.keyFacts?.industry || prev.aio.keyFacts.industry,
            stockTicker: result.aio?.keyFacts?.stockTicker || prev.aio.keyFacts.stockTicker,
          },
        },
        schemas: {
          ...prev.schemas,
          person: {
            ...prev.schemas.person,
            enabled: result.person?.name ? true : prev.schemas.person.enabled,
            name: result.person?.name || prev.schemas.person.name,
            jobTitle: result.person?.jobTitle || prev.schemas.person.jobTitle,
            sameAs: result.person?.sameAs?.length ? result.person.sameAs : prev.schemas.person.sameAs,
          },
        },
      }))

      setSuccess('AI suggestions applied. Review the fields below and save when ready.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions')
    } finally {
      setIsPrefilling(false)
    }
  }, [companyUuid, companyData.website, prefillWebsite])

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

  function updateTracking<K extends keyof SeoConfig['tracking']>(key: K, value: string) {
    setConfig(prev => ({
      ...prev,
      tracking: { ...prev.tracking, [key]: value },
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

  async function handleSave() {
    setError(null)
    setSuccess(null)

    setIsSaving(true)
    try {
      const response = await fetch(`/api/company/${companyUuid}/seo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonLd: autoGenerated, seo: config }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      setSuccess('SEO settings saved successfully.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCopy() {
    const scriptBlock = `<script type="application/ld+json">\n${jsonLdText}\n</script>`
    await navigator.clipboard.writeText(scriptBlock)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const saveButton = !readOnly && (
    <Button onClick={handleSave} disabled={isSaving} size="lg">
      {isSaving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      Save All Settings
    </Button>
  )

  return (
    <fieldset disabled={readOnly} className="space-y-6">
      {/* Top save button — visible without scrolling */}
      {!readOnly && <div className="flex justify-end">{saveButton}</div>}

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 border border-red-200 p-3 rounded-lg">{error}</div>
      )}
      {success && (
        <div className="text-sm text-green-700 dark:text-green-400 bg-green-50 border border-green-200 p-3 rounded-lg">{success}</div>
      )}

      {/* NewsArticle JSON-LD Preview Card (collapsed by default) */}
      <Card>
        <Collapsible>
          <CollapsibleTrigger className="group w-full text-left">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>NewsArticle JSON-LD Preview</CardTitle>
                  <CardDescription>
                    This is how the structured data will appear on your live press release pages. Your organization data is embedded as the <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">author</code> inside a <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">NewsArticle</code> schema. Placeholder values are filled in with actual article data when published.
                  </CardDescription>
                </div>
                <ChevronDown className="h-5 w-5 flex-shrink-0 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
          <pre className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-4 font-mono text-sm leading-relaxed overflow-x-auto whitespace-pre-wrap">
            {articlePreviewText}
          </pre>

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

          <div className="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400 bg-blue-50 border border-blue-100 rounded-lg p-3">
            <Info className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
            <p>
              <strong className="text-gray-700 dark:text-gray-300">What is JSON-LD?</strong> JSON-LD is a structured data format used by
              Google, Bing, and AI tools to understand your organization. Your company details appear as the <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">author</code> inside
              a <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">NewsArticle</code> schema on each press release page. To update your organization data, edit your <a href={`/company/${companyUuid}/newsroom`} className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800">Newsroom settings</a>.
            </p>
          </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-800 dark:text-blue-400">
          Everything you add below will be used to optimize your content for AI and SEO. Most of this data will be hidden from people reading your press releases, but it will be available to AI models and search engines to provide additional context about your organization.
        </p>
      </div>

      {/* Prefill Using AI Search */}
      {!readOnly && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-900">Prefill Using AI Search</p>
              <p className="text-sm text-purple-700 dark:text-purple-400 mt-0.5">
                {companyData.website
                  ? `We'll visit ${companyData.website} and use AI to fill in as many fields as possible.`
                  : 'Enter your website URL and we\'ll use AI to fill in as many fields as possible.'}
              </p>
            </div>
          </div>
          {!companyData.website && (
            <Input
              value={prefillWebsite}
              onChange={(e) => setPrefillWebsite(e.target.value)}
              placeholder="https://yourcompany.com"
              className="bg-white dark:bg-gray-900"
            />
          )}
          <Button
            type="button"
            onClick={handlePrefill}
            disabled={isPrefilling || (!companyData.website && !prefillWebsite)}
            variant="outline"
            className="border-purple-300 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:bg-purple-900/30"
          >
            {isPrefilling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Prefill Using AI Search
              </>
            )}
          </Button>
        </div>
      )}

      {/* Newsroom Meta Defaults Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-gray-500 dark:text-gray-400" />
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

      {/* Retargeting Pixels Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <CardTitle>Retargeting Pixels</CardTitle>
          </div>
          <CardDescription>
            Add tracking pixels to your press releases for audience retargeting. These will be automatically injected into every published press release for this brand.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="gtm-id">Google Tag Manager ID</Label>
              <HelpTip
                title="Google Tag Manager ID"
                content="Your Google Tag Manager container ID. This loads GTM on your press release pages, allowing you to manage all your marketing tags in one place. Find this in your GTM account — the format is 'GTM-' followed by an alphanumeric string (e.g., GTM-XXXXXXX)."
              />
            </div>
            <Input
              id="gtm-id"
              value={config.tracking.gtmId}
              onChange={(e) => updateTracking('gtmId', e.target.value)}
              placeholder="GTM-XXXXXXX"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="google-ads-id">Google Ads Remarketing ID</Label>
              <HelpTip
                title="Google Ads Remarketing ID"
                content="Your Google Ads conversion tracking ID. This loads the Google global site tag (gtag.js) on your press release pages, enabling remarketing and conversion tracking. Find this in your Google Ads account under Tools > Conversions. The format is 'AW-' followed by a numeric ID (e.g., AW-123456789)."
              />
            </div>
            <Input
              id="google-ads-id"
              value={config.tracking.googleAdsId}
              onChange={(e) => updateTracking('googleAdsId', e.target.value)}
              placeholder="AW-123456789"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="meta-pixel-id">Meta (Facebook) Pixel ID</Label>
              <HelpTip
                title="Meta (Facebook) Pixel ID"
                content="Your Meta (Facebook) Pixel ID for conversion tracking and audience retargeting. Find this in your Meta Events Manager. The format is a numeric string (e.g., 123456789012345)."
              />
            </div>
            <Input
              id="meta-pixel-id"
              value={config.tracking.metaPixelId}
              onChange={(e) => updateTracking('metaPixelId', e.target.value)}
              placeholder="123456789012345"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="reddit-pixel-id">Reddit Pixel ID</Label>
              <HelpTip
                title="Reddit Pixel ID"
                content="Your Reddit Ads pixel ID for conversion tracking and audience retargeting. Find this in your Reddit Ads account under Events Manager > Pixel. The format is 't2_' followed by an alphanumeric string (e.g., t2_abc123)."
              />
            </div>
            <Input
              id="reddit-pixel-id"
              value={config.tracking.redditPixelId}
              onChange={(e) => updateTracking('redditPixelId', e.target.value)}
              placeholder="t2_abc123"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="clarity-id">Microsoft Clarity ID</Label>
              <HelpTip
                title="Microsoft Clarity ID"
                content="Your Microsoft Clarity project ID for heatmaps and session recordings. Find this in your Clarity dashboard under Settings > Overview. The format is an alphanumeric string (e.g., abc123def4)."
              />
            </div>
            <Input
              id="clarity-id"
              value={config.tracking.clarityId}
              onChange={(e) => updateTracking('clarityId', e.target.value)}
              placeholder="abc123def4"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="hubspot-id">HubSpot Portal ID</Label>
              <HelpTip
                title="HubSpot Portal ID"
                content="Your HubSpot portal (account) ID for tracking visitors and capturing leads. Find this in your HubSpot account under Settings > Account Management. The format is a numeric string (e.g., 12345678)."
              />
            </div>
            <Input
              id="hubspot-id"
              value={config.tracking.hubspotId}
              onChange={(e) => updateTracking('hubspotId', e.target.value)}
              placeholder="12345678"
            />
          </div>
        </CardContent>
      </Card>

      {/* AI/LLM Optimization Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-gray-500 dark:text-gray-400" />
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
                  <Label htmlFor="founded-year" className="text-xs text-gray-500 dark:text-gray-400">Founded Year</Label>
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
                  <Label htmlFor="hq-location" className="text-xs text-gray-500 dark:text-gray-400">HQ Location</Label>
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
                  <Label htmlFor="employee-count" className="text-xs text-gray-500 dark:text-gray-400">Employee Count</Label>
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
                  <Label htmlFor="industry" className="text-xs text-gray-500 dark:text-gray-400">Industry</Label>
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
                  <Label htmlFor="stock-ticker" className="text-xs text-gray-500 dark:text-gray-400">Stock Ticker (optional)</Label>
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
            <Braces className="h-5 w-5 text-gray-500 dark:text-gray-400" />
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
                    <Label htmlFor="latitude" className="text-xs text-gray-500 dark:text-gray-400">Latitude</Label>
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
                    <Label htmlFor="longitude" className="text-xs text-gray-500 dark:text-gray-400">Longitude</Label>
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
                    <Label htmlFor="opening-hours" className="text-xs text-gray-500 dark:text-gray-400">Opening Hours</Label>
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
                    <Label htmlFor="price-range" className="text-xs text-gray-500 dark:text-gray-400">Price Range</Label>
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

          <hr className="border-gray-200 dark:border-gray-800" />

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
                      <Label htmlFor="person-name" className="text-xs text-gray-500 dark:text-gray-400">Name</Label>
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
                      <Label htmlFor="person-title" className="text-xs text-gray-500 dark:text-gray-400">Job Title</Label>
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
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Photo</Label>
                    <HelpTip
                      title="Person Photo"
                      content="A professional headshot of this person. This image may be used in search engine Knowledge Panels and rich results. Use a high-quality photo (at least 400x400 pixels, square crop preferred). You can upload an image or paste a URL."
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      ref={headshotInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        e.target.value = ''
                        handleHeadshotUpload(file)
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => headshotInputRef.current?.click()}
                      disabled={isUploadingHeadshot}
                      className="relative group cursor-pointer flex-shrink-0"
                    >
                      {isUploadingHeadshot ? (
                        <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        </div>
                      ) : config.schemas.person.image ? (
                        <div className="relative">
                          <img src={config.schemas.person.image} alt="" className="h-16 w-16 rounded-full object-cover" />
                          <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <Camera className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      ) : (
                        <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 group-hover:border-cyan-600 flex items-center justify-center transition-colors">
                          <Camera className="h-5 w-5 text-gray-400 group-hover:text-cyan-600 dark:text-cyan-400 transition-colors" />
                        </div>
                      )}
                    </button>
                    <div className="flex-1">
                      <Input
                        id="person-image"
                        type="url"
                        value={config.schemas.person.image}
                        onChange={(e) => updatePerson('image', e.target.value)}
                        placeholder="https://example.com/photo.jpg"
                      />
                      <p className="text-xs text-gray-400 mt-1">Upload a photo or paste a URL</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-gray-500 dark:text-gray-400">Social Profile URLs</Label>
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

          <hr className="border-gray-200 dark:border-gray-800" />

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
              <p className="text-sm text-gray-500 dark:text-gray-400">No FAQ items added yet. Click &quot;Add Question&quot; to start.</p>
            )}

            {config.schemas.faq.map((item, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Question {index + 1}</span>
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

          <hr className="border-gray-200 dark:border-gray-800" />

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
                <p className="text-xs text-gray-500 dark:text-gray-400">Auto-generated from your newsroom structure.</p>
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

      {/* Save Button */}
      {!readOnly && <div className="flex items-center gap-3">{saveButton}</div>}
    </fieldset>
  )
}
