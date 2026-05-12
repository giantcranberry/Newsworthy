import { Rule } from '@sanity/types'

// Inline block that lets editors drop a reusable Banner Ad inside portable text
// (page content, content sections, blog posts, etc.).
const banner_ad_embed = {
  name: 'bannerAdEmbed',
  title: 'Banner Ad',
  type: 'object',
  fields: [
    {
      name: 'ad',
      title: 'Ad',
      type: 'reference',
      to: [{ type: 'banner_ad' }],
      validation: (Rule: Rule) => Rule.required(),
    },
  ],
  preview: {
    select: {
      title: 'ad.internalName',
      layout: 'ad.layout',
      media: 'ad.bannerImage',
    },
    prepare({ title, layout, media }: Record<string, any>) {
      return {
        title: title || 'Banner Ad',
        subtitle: layout ? `Embedded banner ad — ${layout}` : 'Embedded banner ad',
        media,
      }
    },
  },
}

export default banner_ad_embed
