import { Post } from './Post'

export type Category = {
  _id: string
  _createdAt: Date
  categoryName: string
  slug: {
    current: string
  }
  description: string
  coverImage: {
    asset: {
      url: string
    }
    alt: string
    credit: string
  }
  posts: Post[]
}
