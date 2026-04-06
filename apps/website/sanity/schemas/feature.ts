const feature = {
  name: 'feature',
  title: 'Product Features',
  type: 'document',
  orderings: [
    {
      title: 'Feature Type',
      name: 'featureTypeAsc',
      by: [
        { field: 'featureType', direction: 'asc' },
        { field: 'title', direction: 'asc' },
      ],
    },
  ],
  preview: {
    select: {
      title: 'title',
      featureType: 'featureType',
    },
    prepare({ title, featureType }: { title: string; featureType: string }) {
      const labels: Record<string, string> = {
        base: 'Base Feature',
        agency: 'Agency Feature',
        addon: 'Add-on Feature',
      }
      return {
        title: title,
        subtitle: labels[featureType] || featureType,
      }
    },
  },
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string'
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 }
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
        ],
        default: ['newsworthy'],
        maxLength: 1,
      },
    },
    {
      name: 'featureType',
      title: 'Feature Type',
      type: 'string',
      of: [{ type: 'array' }],
      options: {
        list: [
          { title: 'Agency Feature', value: 'agency' },
          { title: 'Base Feature', value: 'base' },
          { title: 'Add-on Feature', value: 'addon' },
        ],
        default: ['base'],
        maxLength: 1,
      },
    },
    {
      name: 'textContent',
      title: 'Plain Text Content',
      type: 'string',

    },
    {
      name: 'formattedContent',
      title: 'Formatted Content',
      type: 'array',
      of: [{ type: 'block' }]
    },
    {
      name: 'sortOrder',
      title: 'Sort Order',
      type: 'number'
    },
  ]
}

export default feature
