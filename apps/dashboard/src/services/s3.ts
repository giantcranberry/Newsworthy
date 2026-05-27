import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import sharp from 'sharp'

// Extract just the region code from LINODES3_REGION (might be full hostname)
const regionEnv = process.env.LINODES3_REGION || 'us-southeast-1'
const region = regionEnv.replace('.linodeobjects.com', '')

const s3Client = new S3Client({
  region,
  endpoint: process.env.LINODES3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.LINODES3_ACCESS_KEY!,
    secretAccessKey: process.env.LINODES3_SECRET!,
  },
  forcePathStyle: false,
})

const BUCKET = process.env.LINODES3_BUCKET || 'cdn.newsramp.app'
const CDN_BASE_URL = process.env.NEXT_PUBLIC_S3_URL || `https://us-southeast-1.linodeobjects.com/${BUCKET}`

function extractKey(urlOrFilename: string): string {
  if (urlOrFilename.startsWith('http')) {
    const url = new URL(urlOrFilename)
    return url.pathname.slice(1) // Remove leading slash
  }
  return urlOrFilename
}

/**
 * Upload a company logo.
 *
 * Raster types (PNG/JPG/WebP) are normalized to a 400x400-bounded PNG via sharp.
 * SVG is preserved as-is so it stays vector — sanitized to remove `<script>`
 * blocks and inline event handlers before storage. SVGs are rendered through
 * `<img src>` everywhere in the app, which prevents script execution; this
 * sanitization is defense-in-depth in case someone navigates directly to the
 * CDN URL.
 */
function sanitizeSvg(svg: string): string {
  let s = svg
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<script\b[^>]*\/?>/gi, '')
  s = s.replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '')
  s = s.replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '')
  s = s.replace(/\s+on[a-z]+\s*=\s*[^\s/>]+/gi, '')
  s = s.replace(/(xlink:href|href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=$2#$2')
  return s
}

function looksLikeSvg(buf: Buffer): boolean {
  const head = buf.toString('utf8', 0, 1024).trim()
  return /^(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)?<svg\b/i.test(head)
}

export async function uploadLogo(
  file: Buffer,
  companyId: number,
  mimeType: string
): Promise<string> {
  const isSvg = mimeType === 'image/svg+xml' || looksLikeSvg(file)

  if (isSvg) {
    const sanitized = sanitizeSvg(file.toString('utf8'))
    const filename = `logos/${companyId}-${Date.now()}.svg`

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: filename,
        Body: sanitized,
        ContentType: 'image/svg+xml',
        ACL: 'public-read',
      })
    )

    return `${CDN_BASE_URL}/${filename}`
  }

  const processedImage = await sharp(file)
    .resize(400, 400, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer()

  const filename = `logos/${companyId}-${Date.now()}.png`

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: filename,
      Body: processedImage,
      ContentType: 'image/png',
      ACL: 'public-read',
    })
  )

  return `${CDN_BASE_URL}/${filename}`
}

/**
 * Upload a 1200x630 social banner for a podcast-sourced release. Mirrors the
 * client-side "fit with background" pattern from `image-cropper.tsx`:
 * blurred zoomed-in copy of the source as background, slight dark overlay
 * for contrast, sharp centered foreground on top. This keeps square podcast
 * artwork from showing flat gray bars on either side.
 */
export async function uploadPodcastBanner(
  file: Buffer,
  releaseId: number,
): Promise<{ url: string; width: number; height: number; filesize: number }> {
  const targetWidth = 1200
  const targetHeight = 630

  const background = await sharp(file)
    .rotate()
    .resize(targetWidth, targetHeight, { fit: 'cover' })
    .blur(30)
    .toBuffer()

  const foreground = await sharp(file)
    .rotate()
    .resize(targetWidth, targetHeight, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  const darkOverlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${targetWidth}" height="${targetHeight}"><rect width="100%" height="100%" fill="black" fill-opacity="0.2"/></svg>`,
  )

  const processedImage = await sharp(background)
    .composite([
      { input: darkOverlay, blend: 'over' },
      { input: foreground, blend: 'over' },
    ])
    .jpeg({ quality: 88 })
    .toBuffer()

  const filename = `banners/${releaseId}-${Date.now()}.jpg`

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: filename,
      Body: processedImage,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    }),
  )

  return {
    url: `${CDN_BASE_URL}/${filename}`,
    width: targetWidth,
    height: targetHeight,
    filesize: processedImage.length,
  }
}

/**
 * Upload a podcast episode's downloaded audio file to the CDN bucket.
 * Stored under podcast-audio/{feedId}/{episodeId}-{ts}.{ext}.
 */
export async function uploadPodcastAudio(
  file: Buffer,
  feedId: number,
  episodeId: number,
  contentType: string,
  extension: string,
): Promise<string> {
  const safeExt = (extension || 'mp3').replace(/[^a-z0-9]/gi, '').slice(0, 6) || 'mp3'
  const filename = `podcast-audio/${feedId}/${episodeId}-${Date.now()}.${safeExt}`

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: filename,
      Body: file,
      ContentType: contentType || 'audio/mpeg',
      ACL: 'public-read',
    }),
  )

  return `${CDN_BASE_URL}/${filename}`
}

/**
 * Upload a partner logo
 */
export async function uploadPartnerLogo(
  file: Buffer,
  partnerId: number,
  mimeType: string
): Promise<string> {
  const processedImage = await sharp(file)
    .resize(400, 400, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer()

  const filename = `logos/partner-${partnerId}-${Date.now()}.png`

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: filename,
      Body: processedImage,
      ContentType: 'image/png',
      ACL: 'public-read',
    })
  )

  return `${CDN_BASE_URL}/${filename}`
}

/**
 * Upload a product logo
 */
export async function uploadProductLogo(
  file: Buffer,
  productId: number,
  mimeType: string
): Promise<string> {
  const processedImage = await sharp(file)
    .resize(400, 400, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer()

  const filename = `logos/product-${productId}-${Date.now()}.png`

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: filename,
      Body: processedImage,
      ContentType: 'image/png',
      ACL: 'public-read',
    })
  )

  return `${CDN_BASE_URL}/${filename}`
}

/**
 * Delete a logo from S3
 */
export async function deleteLogo(urlOrFilename: string): Promise<void> {
  if (!urlOrFilename) return

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: extractKey(urlOrFilename),
      })
    )
  } catch (error) {
    console.error('Error deleting logo:', error)
  }
}

/**
 * Upload a spokesperson/person headshot
 */
export async function uploadPersonHeadshot(
  file: Buffer,
  companyId: number,
  mimeType: string
): Promise<string> {
  const processedImage = await sharp(file)
    .resize(400, 400, {
      fit: 'cover',
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 90 })
    .toBuffer()

  const filename = `headshots/${companyId}-${Date.now()}.jpg`

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: filename,
      Body: processedImage,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    })
  )

  return `${CDN_BASE_URL}/${filename}`
}

/**
 * Upload a contact avatar
 */
export async function uploadContactAvatar(
  file: Buffer,
  contactId: number,
  mimeType: string
): Promise<string> {
  const processedImage = await sharp(file)
    .resize(200, 200, {
      fit: 'cover',
    })
    .png()
    .toBuffer()

  const filename = `avatars/contact-${contactId}-${Date.now()}.png`

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: filename,
      Body: processedImage,
      ContentType: 'image/png',
      ACL: 'public-read',
    })
  )

  return `${CDN_BASE_URL}/${filename}`
}

/**
 * Upload a user profile avatar
 */
export async function uploadUserAvatar(
  file: Buffer,
  userId: number,
  mimeType: string
): Promise<string> {
  const processedImage = await sharp(file)
    .resize(200, 200, {
      fit: 'cover',
    })
    .png()
    .toBuffer()

  const filename = `avatars/user-${userId}-${Date.now()}.png`

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: filename,
      Body: processedImage,
      ContentType: 'image/png',
      ACL: 'public-read',
    })
  )

  return `${CDN_BASE_URL}/${filename}`
}

/**
 * Upload a press release image
 */
export async function uploadPRImage(
  file: Buffer,
  releaseId: number,
  type: 'primary' | 'banner' = 'primary'
): Promise<{ url: string; width: number; height: number; filesize: number }> {
  const image = sharp(file)
  const metadata = await image.metadata()

  let processedImage: Buffer
  let width: number
  let height: number

  if (type === 'banner') {
    // Social banner: client-side react-easy-crop handles all cropping
    // and fit-with-background processing before upload.
    // Server just normalizes to JPEG and ensures 1200x630.
    const targetWidth = 1200
    const targetHeight = 630

    processedImage = await sharp(file)
      .resize(targetWidth, targetHeight, { fit: 'fill' })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 85 })
      .toBuffer()

    width = targetWidth
    height = targetHeight
  } else {
    // Primary image: max 1200x1200, preserve aspect ratio and orientation.
    // Use .rotate() to normalize EXIF orientation first, then resize.
    processedImage = await sharp(file)
      .rotate()
      .resize(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 85 })
      .toBuffer()

    const processedMetadata = await sharp(processedImage).metadata()
    width = processedMetadata.width || metadata.width || 1200
    height = processedMetadata.height || metadata.height || 800
  }

  const folder = type === 'banner' ? 'banners' : 'images'
  const filename = `${folder}/${releaseId}-${Date.now()}.jpg`

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: filename,
      Body: processedImage,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    })
  )

  return {
    url: `${CDN_BASE_URL}/${filename}`,
    width,
    height,
    filesize: processedImage.length,
  }
}

/**
 * Upload a company image asset (news image library)
 */
export async function uploadCompanyImage(
  file: Buffer,
  companyId: number
): Promise<{ url: string; width: number; height: number; filesize: number }> {
  const processedImage = await sharp(file)
    .rotate()
    .resize(1200, 800, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 85 })
    .toBuffer()

  const processedMetadata = await sharp(processedImage).metadata()
  const width = processedMetadata.width || 1200
  const height = processedMetadata.height || 800

  const filename = `images/co-${companyId}-${Date.now()}.jpg`

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: filename,
      Body: processedImage,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    })
  )

  return {
    url: `${CDN_BASE_URL}/${filename}`,
    width,
    height,
    filesize: processedImage.length,
  }
}

/**
 * Delete a PR image from S3
 */
export async function deletePRImage(urlOrFilename: string): Promise<void> {
  if (!urlOrFilename) return

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: extractKey(urlOrFilename),
      })
    )
  } catch (error) {
    console.error('Error deleting image:', error)
  }
}

/**
 * Upload a task file (any type — no image processing)
 */
export async function uploadTaskFile(
  file: Buffer,
  taskId: number,
  originalFilename: string,
  mimeType: string
): Promise<{ url: string; filesize: number }> {
  const sanitized = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `task_files/${taskId}-${Date.now()}-${sanitized}`

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file,
      ContentType: mimeType,
      ACL: 'public-read',
    })
  )

  return {
    url: `${CDN_BASE_URL}/${key}`,
    filesize: file.length,
  }
}

/**
 * Delete a task file from S3
 */
export async function deleteTaskFile(urlOrFilename: string): Promise<void> {
  if (!urlOrFilename) return

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: extractKey(urlOrFilename),
      })
    )
  } catch (error) {
    console.error('Error deleting task file:', error)
  }
}

/**
 * Upload a community post image
 */
export async function uploadCommunityImage(
  file: Buffer,
  postId: number
): Promise<{ url: string; width: number; height: number }> {
  const processedImage = await sharp(file)
    .rotate()
    .resize(1200, 800, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 85 })
    .toBuffer()

  const processedMetadata = await sharp(processedImage).metadata()
  const width = processedMetadata.width || 1200
  const height = processedMetadata.height || 800

  const filename = `community/${postId}-${Date.now()}.jpg`

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: filename,
      Body: processedImage,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    })
  )

  return {
    url: `${CDN_BASE_URL}/${filename}`,
    width,
    height,
  }
}

/**
 * Delete a community post image from S3
 */
export async function deleteCommunityImage(urlOrFilename: string): Promise<void> {
  if (!urlOrFilename) return

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: extractKey(urlOrFilename),
      })
    )
  } catch (error) {
    console.error('Error deleting community image:', error)
  }
}

export { CDN_BASE_URL, BUCKET }
