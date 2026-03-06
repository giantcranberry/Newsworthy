import { Post } from './Post'

export type Author = {
  _id: string
  _createdAt: Date
  name: string
  slug: {
    current: string
  }
  shortBio: string
  seoDescription: string
  linkedin: string
  image: {
    asset: {
      url: string
    }
  }
  posts: Post[]
  bio: string
}
