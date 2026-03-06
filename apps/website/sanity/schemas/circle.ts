const circle = {
  name: 'circle',
  title: 'Founders Circle',
  type: 'document',
  fields: [
    {
      name: 'person',
      title: 'Person',
      type: 'string'
    },
    {
      name: 'about',
      title: 'About',
      type: 'array',
      of: [{ type: 'block' }]
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

export default circle
