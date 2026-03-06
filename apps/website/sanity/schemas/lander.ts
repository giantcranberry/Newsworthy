const lander = {
  name: 'lander',
  title: 'Landing Pages',
  type: 'document',
  fields: [
    {
      title: 'Title',
      name: 'title',
      type: 'string'
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 }
    },
    {
      name: 'seoDescription',
      title: 'SEO Description',
      type: 'string',
      options: { maxLength: 160 }
    }
  ]
}

export default lander
