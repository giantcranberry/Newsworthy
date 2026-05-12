import { Rule } from '@sanity/types'

type DocCtx = { document?: Record<string, any> }

const LAYOUTS = [
  { title: 'Split — text + image side-by-side (banner)', value: 'split' },
  { title: 'Text band — callout strip, no image', value: 'band' },
  { title: 'Image only — clickable banner image', value: 'image' },
  { title: 'Card — compact sidebar card', value: 'card' },
]

const PLACEMENTS = [
  { title: 'News feed band (between news cards)', value: 'news-feed-band' },
  { title: 'In-content block (embedded in a page)', value: 'content-block' },
  { title: 'Navbar', value: 'navbar' },
  { title: 'Sidebar', value: 'sidebar' },
  { title: 'Popup / modal', value: 'popup' },
]

const GRADIENT_DIRECTIONS = [
  { title: 'Left → Right', value: 'to right' },
  { title: 'Top → Bottom', value: 'to bottom' },
  { title: 'Diagonal ↘ (top-left → bottom-right)', value: '135deg' },
  { title: 'Diagonal ↗ (bottom-left → top-right)', value: '45deg' },
  { title: 'Radial (from top-right)', value: 'radial' },
]

const CTA_STYLES = [
  { title: 'Primary (solid)', value: 'primary' },
  { title: 'Secondary (solid, alternate color)', value: 'secondary' },
  { title: 'Outline', value: 'outline' },
  { title: 'Text link', value: 'link' },
]

const urlValidation = (Rule: Rule) =>
  Rule.uri({ allowRelative: true, scheme: ['http', 'https', 'mailto', 'tel'] })

// Warns (does not block) when a color field looks like a malformed hex value.
// rgb()/hsl()/keyword values are left alone.
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const colorWarning = (Rule: Rule) =>
  Rule.custom((value?: string) => {
    if (!value) return true
    const v = value.trim()
    if (v.startsWith('#') && !HEX_RE.test(v)) {
      return 'Not a valid hex color — use 3 or 6 hex digits, e.g. #9D1D21'
    }
    return true
  }).warning()

const banner_ad = {
  name: 'banner_ad',
  title: 'Banner Ads',
  type: 'document',
  groups: [
    { name: 'content', title: 'Content', default: true },
    { name: 'style', title: 'Style & Background' },
    { name: 'settings', title: 'Settings & Targeting' },
  ],
  fields: [
    // ---- Settings & targeting ----
    {
      name: 'internalName',
      title: 'Internal Name',
      type: 'string',
      group: 'settings',
      description: 'For the CMS list only — never shown on the site.',
      validation: (Rule: Rule) => Rule.required(),
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'settings',
      description: 'Used to fetch this ad (e.g. <BannerAdBand slug="news-marketing-book" />).',
      options: { source: 'internalName', maxLength: 96 },
      validation: (Rule: Rule) => Rule.required(),
    },
    {
      name: 'enabled',
      title: 'Enabled',
      type: 'boolean',
      group: 'settings',
      description: 'Uncheck to hide everywhere without deleting.',
      initialValue: true,
    },
    {
      name: 'placements',
      title: 'Allowed placements',
      type: 'array',
      group: 'settings',
      of: [{ type: 'string' }],
      options: { list: PLACEMENTS },
    },
    {
      name: 'priority',
      title: 'Priority',
      type: 'number',
      group: 'settings',
      description: 'Higher numbers win when several ads compete for the same slot.',
      initialValue: 0,
    },
    {
      name: 'startDate',
      title: 'Start showing on',
      type: 'datetime',
      group: 'settings',
      description: 'Optional. Leave blank to start immediately.',
    },
    {
      name: 'endDate',
      title: 'Stop showing on',
      type: 'datetime',
      group: 'settings',
      description: 'Optional. Leave blank to run indefinitely.',
    },
    {
      name: 'disclosureLabel',
      title: 'Disclosure label',
      type: 'string',
      group: 'settings',
      description: 'Optional small badge, e.g. "Sponsored" or "Ad". Leave blank for none.',
    },
    {
      name: 'layout',
      title: 'Layout',
      type: 'string',
      group: 'settings',
      options: { list: LAYOUTS, layout: 'radio' },
      initialValue: 'split',
      validation: (Rule: Rule) => Rule.required(),
    },
    {
      name: 'stacked',
      title: 'Stacked layout (always single column)',
      type: 'boolean',
      group: 'settings',
      description:
        'For the "Split" layout: stack the text over the image at every screen size instead of side-by-side. Also uses the mobile image if one is provided. Handy in narrow placements like a sidebar.',
      initialValue: false,
      hidden: ({ document }: DocCtx) => (document?.layout ?? 'split') !== 'split',
    },

    // ---- Content ----
    {
      name: 'logo',
      title: 'Logo',
      type: 'image',
      group: 'content',
      description: 'Small brand logo shown above the headline.',
      options: { hotspot: true },
      fields: [{ name: 'alt', title: 'Alt text', type: 'string' }],
    },
    {
      name: 'eyebrow',
      title: 'Eyebrow / kicker',
      type: 'string',
      group: 'content',
      description: 'Small uppercase line above the headline.',
    },
    {
      name: 'headline',
      title: 'Headline',
      type: 'string',
      group: 'content',
    },
    {
      name: 'body',
      title: 'Body copy',
      type: 'array',
      group: 'content',
      of: [
        {
          type: 'block',
          styles: [{ title: 'Normal', value: 'normal' }],
          lists: [{ title: 'Bullet', value: 'bullet' }],
          marks: {
            decorators: [
              { title: 'Bold', value: 'strong' },
              { title: 'Italic', value: 'em' },
            ],
            annotations: [
              {
                name: 'link',
                title: 'Link',
                type: 'object',
                fields: [{ name: 'href', title: 'URL', type: 'url', validation: urlValidation }],
              },
            ],
          },
        },
      ],
    },
    {
      name: 'bannerImage',
      title: 'Banner image',
      type: 'image',
      group: 'content',
      description: 'Main visual. For the "Image only" layout this is the whole ad.',
      options: { hotspot: true },
      fields: [
        { name: 'alt', title: 'Alt text', type: 'string' },
        { name: 'credit', title: 'Image credit', type: 'string' },
      ],
    },
    {
      name: 'mobileImage',
      title: 'Mobile image (optional)',
      type: 'image',
      group: 'content',
      description: 'Optional alternate crop used on small screens.',
      options: { hotspot: true },
      fields: [{ name: 'alt', title: 'Alt text', type: 'string' }],
    },
    {
      name: 'imageSide',
      title: 'Image side',
      type: 'string',
      group: 'content',
      options: {
        list: [
          { title: 'Right', value: 'right' },
          { title: 'Left', value: 'left' },
        ],
        layout: 'radio',
      },
      initialValue: 'right',
      hidden: ({ document }: DocCtx) => document?.layout !== 'split',
    },
    {
      name: 'href',
      title: 'Whole-ad link',
      type: 'url',
      group: 'content',
      description:
        'Used when layout is "Image only", and as a fallback click target if there are no CTA buttons.',
      validation: urlValidation,
    },
    {
      name: 'ctas',
      title: 'CTA buttons',
      type: 'array',
      group: 'content',
      description: 'Up to two buttons.',
      validation: (Rule: Rule) => Rule.max(2),
      of: [
        {
          type: 'object',
          name: 'cta',
          fields: [
            { name: 'label', title: 'Label', type: 'string', validation: (Rule: Rule) => Rule.required() },
            { name: 'url', title: 'URL', type: 'url', validation: urlValidation },
            {
              name: 'style',
              title: 'Style',
              type: 'string',
              description: 'Base style. Override the colors below if you want a custom look.',
              options: { list: CTA_STYLES },
              initialValue: 'primary',
            },
            {
              name: 'bgColor',
              title: 'Button color (override)',
              type: 'string',
              description: 'Optional hex value with the # — e.g. #000000. Overrides the style preset background.',
              validation: colorWarning,
            },
            {
              name: 'textColor',
              title: 'Button text color (override)',
              type: 'string',
              description: 'Optional hex value with the # — e.g. #ffffff.',
              validation: colorWarning,
            },
            { name: 'openInNewTab', title: 'Open in new tab', type: 'boolean', initialValue: false },
            {
              name: 'sponsored',
              title: 'Mark link as sponsored (rel="sponsored nofollow")',
              type: 'boolean',
              initialValue: true,
            },
          ],
          preview: {
            select: { title: 'label', subtitle: 'url', style: 'style' },
            prepare({ title, subtitle, style }: Record<string, any>) {
              return { title: title || 'CTA', subtitle: [style, subtitle].filter(Boolean).join(' · ') }
            },
          },
        },
      ],
    },

    // ---- Style & background ----
    {
      name: 'theme',
      title: 'Text theme',
      type: 'string',
      group: 'style',
      description: 'Pick the one that contrasts your background.',
      options: {
        list: [
          { title: 'Light text (for dark backgrounds)', value: 'dark' },
          { title: 'Dark text (for light backgrounds)', value: 'light' },
        ],
        layout: 'radio',
      },
      initialValue: 'dark',
    },
    {
      name: 'backgroundColor',
      title: 'Background color',
      type: 'string',
      group: 'style',
      description: 'Hex value with the # — e.g. #8e1d1d. Used as a fallback if the gradient is invalid.',
      validation: colorWarning,
    },
    {
      name: 'useGradient',
      title: 'Use gradient background',
      type: 'boolean',
      group: 'style',
      initialValue: false,
    },
    {
      name: 'gradientFrom',
      title: 'Gradient — start color',
      type: 'string',
      group: 'style',
      description: 'Hex value with the # — e.g. #530008 (3 or 6 hex digits).',
      validation: colorWarning,
      hidden: ({ document }: DocCtx) => !document?.useGradient,
    },
    {
      name: 'gradientVia',
      title: 'Gradient — middle color (optional)',
      type: 'string',
      group: 'style',
      description: 'Hex value with the #. Leave blank for a two-color gradient.',
      validation: colorWarning,
      hidden: ({ document }: DocCtx) => !document?.useGradient,
    },
    {
      name: 'gradientTo',
      title: 'Gradient — end color',
      type: 'string',
      group: 'style',
      description: 'Hex value with the # — e.g. #9D1D21 (3 or 6 hex digits).',
      validation: colorWarning,
      hidden: ({ document }: DocCtx) => !document?.useGradient,
    },
    {
      name: 'gradientDirection',
      title: 'Gradient direction',
      type: 'string',
      group: 'style',
      options: { list: GRADIENT_DIRECTIONS },
      initialValue: '135deg',
      hidden: ({ document }: DocCtx) => !document?.useGradient,
    },
    {
      name: 'textColor',
      title: 'Text color override',
      type: 'string',
      group: 'style',
      description: 'Optional hex value with the #. Overrides the color implied by the text theme.',
      validation: colorWarning,
    },
    {
      name: 'accentColor',
      title: 'Accent color (primary button)',
      type: 'string',
      group: 'style',
      description: 'Optional hex value with the # for the primary CTA button background.',
      validation: colorWarning,
    },
    {
      name: 'customCss',
      title: 'Custom CSS',
      type: 'text',
      group: 'style',
      rows: 8,
      description:
        'Advanced. CSS only — prefix selectors with "#banner-ad-<slug>" or ".banner-ad" so it stays scoped to this ad (e.g. "#banner-ad-news-marketing-book h2 { letter-spacing: .04em }"). Anything risky (script/style tags, @import, expression(), behavior, -moz-binding, javascript: urls, raw HTML) is stripped before it is rendered.',
      validation: (Rule: Rule) =>
        Rule.custom((value?: string) => {
          if (!value) return true
          const flagged = [/<\/?\s*script/i, /<\/?\s*style/i, /@import/i, /expression\s*\(/i, /-moz-binding/i, /\bbehavior\s*:/i, /(?:javascript|vbscript)\s*:/i]
            .some((re) => re.test(value))
          return flagged
            ? 'This CSS contains patterns that will be stripped for security (script/style tags, @import, expression(), behavior, -moz-binding, javascript:). Remove them so the styles render as written.'
            : true
        }).warning(),
    },
  ],
  preview: {
    select: {
      title: 'internalName',
      layout: 'layout',
      enabled: 'enabled',
      media: 'bannerImage',
    },
    prepare({ title, layout, enabled, media }: Record<string, any>) {
      const bits = [layout ? `Layout: ${layout}` : null, enabled === false ? 'DISABLED' : null].filter(Boolean)
      return { title: title || 'Untitled banner ad', subtitle: bits.join(' · ') || 'Banner ad', media }
    },
  },
}

export default banner_ad
