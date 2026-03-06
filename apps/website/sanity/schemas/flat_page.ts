const flatpage = {
  name: 'flatpage',
  title: 'Flat Pages',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      description: 'This is the head title and will show up in the browser tab and search results.',
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
      description: 'This is the description that will show up in search results, social media posts and page Meta tags.',
      type: 'string',
      options: { maxLength: 160 }
    },
    {
      name: 'content',
      title: 'Content',
      type: 'array',
      of: [{ type: 'block' }, { type: 'image' }]
    },
    {
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
      fields: [
        {
          name: 'alt',
          title: 'Alternative Text',
          type: 'string'
        }
      ]
    }
  ]
}

export default flatpage
