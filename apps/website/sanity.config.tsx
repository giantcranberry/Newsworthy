import { defineConfig } from 'sanity'
import { deskTool } from 'sanity/desk'
import schemas from './sanity/schemas'
import { unsplashImageAsset } from 'sanity-plugin-asset-source-unsplash'

const config = defineConfig({
  projectId: 'vt7ifwmf',
  dataset: 'production',
  title: 'Newsworthy.ai',
  apiVersion: '2023-06-28',
  basePath: '/admin',
  plugins: [deskTool(), unsplashImageAsset()],
  schema: { types: schemas },
  useCdn: true, 
})

export default config
