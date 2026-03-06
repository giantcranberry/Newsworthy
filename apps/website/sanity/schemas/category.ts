const category = {
  name: 'category',
  title: 'Blog Post Categories',
  type: 'document',
  fields: [
    {
      name: 'categoryName',
      title: 'Category Name',
      type: 'string'
    },
    {
      name: 'seoDescription',
      title: 'SEO Description',
      type: 'string',
      options: { maxLength: 160 }
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'categoryName', maxLength: 96 }
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
      name: 'description',
      title: 'Description',
      type: 'text'
    }
  ],
  preview: {
    select: {
      title: 'categoryName'
    }
  }
}
export default category
