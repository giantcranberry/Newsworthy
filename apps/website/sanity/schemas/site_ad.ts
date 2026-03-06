import { Rule } from '@sanity/types'

const site_ad = {
  name: 'site_ad',
  title: 'Site Ads',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
    },
    {
      name: 'subtitle',
      title: 'Sub Title',
      type: 'string',
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
    },
    {
      name: 'ad_type',
      title: 'Ad Type',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        list: [
          { title: 'Navbar', value: 'navbar' },
          { title: 'Sidebar', value: 'sidebar' },
          { title: 'Callout Band', value: 'callout' },
        ],
      },
    },
    {
      name: 'ad_image',
      title: 'Ad Image',
      type: 'image',
      options: { hotspot: true },
      fields: [
        { name: 'alt', title: 'Alternative Text', type: 'string' },
        { name: 'credit', title: 'Image Credits', type: 'string' },
      ],
    },
    {
      name: 'textContent',
      title: 'Plain Text Content',
      type: 'text',
    },
    {
      name: 'ad_cta',
      title: 'Ad CTA',
      type: 'object',
      fields: [
        {
          name: 'cta_text',
          title: 'CTA Text',
          type: 'string',
        },
        {
          name: 'cta_link',
          title: 'CTA Link',
          type: 'url',
          validation: (Rule: Rule) =>
            Rule.uri({
              scheme: ['http', 'https', 'mailto', 'tel'],
            }),
        },
      ],
    },
    {
      name: 'ad_cta_2',
      title: 'Ad CTA 2',
      type: 'object',
      fields: [
        {
          name: 'cta_text',
          title: 'CTA Text',
          type: 'string',
        },
        {
          name: 'cta_link',
          title: 'CTA Link',
          type: 'url',
          validation: (Rule: Rule) =>
            Rule.uri({
              scheme: ['http', 'https', 'mailto', 'tel'],
            }),
        },
      ],
    },
  ],
}

export default site_ad
