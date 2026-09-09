import 'server-only'

import { makeObjectPublic, readObjectHead } from '@/services/s3'
import { getExtension, sniffForbiddenContent } from '@/lib/file-attachments'

/**
 * Verify a just-uploaded object via authenticated S3, then make it public-read.
 * Uses the object key (not the public URL) so we don't depend on ACL/CDN yet.
 */
export async function verifyUploadedObjectHead(
  keyOrUrl: string,
  filename: string
): Promise<string | null> {
  const ext = getExtension(filename)
  try {
    const buf = await readObjectHead(keyOrUrl, 1024)
    const issue = sniffForbiddenContent(buf, ext)
    if (issue) return issue

    // Safe content — publish for press-kit downloads
    try {
      await makeObjectPublic(keyOrUrl)
    } catch (aclErr) {
      console.error('[files] makeObjectPublic failed:', aclErr)
      return 'File uploaded but could not be made public. Check bucket ACL settings.'
    }

    return null
  } catch (err) {
    console.error('[files] verifyUploadedObjectHead failed:', err)
    return 'Unable to verify uploaded file contents'
  }
}
