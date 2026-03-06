import { Page } from './Page'

export type Navbar = {
  _id: string
  _createdAt: Date
  title: string
  slug: {
    current: string
  }
  pages: Page[]
}
