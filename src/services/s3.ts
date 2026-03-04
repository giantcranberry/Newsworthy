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
 * Upload a company logo
 */
export async function uploadLogo(
  file: Buffer,
  companyId: number,
  mimeType: string
): Promise<string> {
  // Resize logo to max 400x400, maintain aspect ratio
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
      .jpeg({ quality: 85 })
      .toBuffer()

    width = targetWidth
    height = targetHeight
  } else {
    // Primary image: max 1200x800, preserve aspect ratio
    processedImage = await image
      .resize(1200, 800, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer()

    const processedMetadata = await sharp(processedImage).metadata()
    width = processedMetadata.width || 1200
    height = processedMetadata.height || 800
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

export { CDN_BASE_URL, BUCKET }
