import { PortableTextBlock } from 'sanity'

export type FlatPage = {
  _id: string
  _type: string
  _createdAt: Date
  title: string
  slug: {
    current: string
  }
  centered_content: boolean
  content: PortableTextBlock[]
  image: {
    asset: {
      url: string
    }
    alt: string
    credit: string
  }
}
