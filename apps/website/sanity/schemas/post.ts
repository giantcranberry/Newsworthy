import Image from 'next/image'

const post = {
  name: 'post',
  title: 'Blog Posts',
  type: 'document',

  fields: [
    {
      name: 'headline',
      title: 'Headline',
      description: 'This is the head title and will show up in the browser tab and search results.',
      type: 'string'
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'headline', maxLength: 96 }
    },
    {
      name: 'seoDescription',
      title: 'SEO Description',
      description: 'This is the description that will show up in search results, social media posts and page Meta tags.',
      type: 'string',
      options: { maxLength: 160 }
    },
    {
      name: 'siteId',
      title: 'Site ID',
      type: 'string',
      of: [{ type: 'array' }],
      options: {
        list: [
          { title: 'Newsworthy.ai', value: 'newsworthy' },
          { title: 'Feedworthy.ai', value: 'feedworthy' },
          { title: 'Cross Post to All Sites', value: 'all' },
        ],
        default: ['newsworthy'],
        maxLength: 1,
      },
    },
    {
      name: 'author',
      title: 'Author',
      type: 'reference',
      to: { type: 'author' }
    },
    {
      name: 'category',
      title: 'Category',
      type: 'reference',
      to: { type: 'category' }
    },
    {
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime'
    },
    {
      name: 'featureOn',
      title: 'Feature On',
      type: 'datetime'
    },
    {
      name: 'coverImage',
      title: 'Cover Image',
      type: 'image',
      options: { hotspot: true },
      fields: [
        {
          name: 'alt',
          title: 'Alternative Text',
          type: 'string'
        },
        { name: 'credit', title: 'Image Credits', type: 'string' }
      ]
    },
    {
      name: 'excerpt',
      title: 'Excerpt',
      type: 'text'
    },
    {
      name: 'content',
      title: 'Content',
      type: 'array',
      of: [{ type: 'block' }, { type: 'image' }]
    }
  ]
}

export default post
