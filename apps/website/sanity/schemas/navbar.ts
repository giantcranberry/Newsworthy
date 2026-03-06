const navbar = {
  name: 'navbar',
  title: 'Navbar Settings',
  type: 'document',
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
      name: 'pages',
      title: 'Pages',
      type: 'array',
      of: [{ type: 'reference', to: { type: 'page' } }]
    }
  ]
}

export default navbar;
