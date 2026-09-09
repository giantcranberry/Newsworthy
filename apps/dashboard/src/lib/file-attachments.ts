/** Shared constants / helpers for brand + press-release file attachments */

export const MAX_FILE_ATTACHMENTS = 3
export const MAX_FILE_SIZE_BYTES = 150 * 1024 * 1024 // 150MB

/** Extension → mime types we accept for uploaded files (no archives — they can hide executables/JS) */
export const ALLOWED_FILE_EXTENSIONS = [
  'pdf',
  'ppt',
  'pptx',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'epub',
  'mp3',
  'mp4',
] as const

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/epub+zip',
  'audio/mpeg',
  'audio/mp3',
  'video/mp4',
])

/** OOXML / EPUB are ZIP containers; browsers sometimes report application/zip */
const ZIP_BASED_EXTENSIONS = new Set(['docx', 'pptx', 'xlsx', 'epub'])

/** Never allow these extensions anywhere in a multi-dot filename (e.g. report.pdf.exe) */
const BLOCKED_EXTENSIONS = new Set([
  // Executables / scripts / installers
  'exe', 'msi', 'msp', 'com', 'scr', 'pif', 'cpl', 'dll', 'sys', 'drv',
  'bat', 'cmd', 'ps1', 'psm1', 'psd1', 'vbs', 'vbe', 'wsf', 'wsh', 'jse',
  'sh', 'bash', 'zsh', 'csh', 'ksh', 'run', 'bin', 'out', 'elf',
  'app', 'dmg', 'pkg', 'command', 'action', 'workflow',
  'apk', 'ipa', 'deb', 'rpm', 'jar', 'war', 'ear',
  // JavaScript / web scriptable content
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'vue', 'svelte',
  'html', 'htm', 'shtml', 'xhtml', 'mhtml', 'mht',
  'svg', 'svgz',
  'css', 'wasm',
  'php', 'phtml', 'asp', 'aspx', 'jsp', 'cgi', 'pl', 'py', 'rb', 'lua',
  // Archives / containers (can embed blocked payloads)
  'zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'lz', 'lzma',
  'iso', 'img', 'cab', 'arj',
  // Shortcuts / macros hosts often abused
  'lnk', 'url', 'desktop', 'reg', 'inf', 'hta', 'msc',
])

const BLOCKED_MIME_PREFIXES = [
  'text/html',
  'text/javascript',
  'application/javascript',
  'application/x-javascript',
  'application/ecmascript',
  'text/ecmascript',
  'text/jscript',
  'application/wasm',
  'image/svg+xml',
  'application/xhtml+xml',
  'text/x-python',
  'application/x-sh',
  'application/x-csh',
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-sharedlib',
  'application/vnd.microsoft.portable-executable',
  'application/java-archive',
  'application/x-java-archive',
  'application/zip',
  'application/x-zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
  'application/gzip',
  'application/x-tar',
]

const EXT_MIME_FALLBACK: Record<string, string> = {
  pdf: 'application/pdf',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  epub: 'application/epub+zip',
}

export function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1]! : ''
}

/** All dotted segments after the basename (handles report.pdf.exe → ['pdf','exe']) */
export function getAllExtensions(filename: string): string[] {
  const base = filename.split(/[/\\]/).pop() || filename
  const parts = base.toLowerCase().split('.')
  if (parts.length < 2) return []
  return parts.slice(1).filter(Boolean)
}

function isBlockedMime(mimeType: string): boolean {
  const mime = mimeType.toLowerCase().split(';')[0]!.trim()
  return BLOCKED_MIME_PREFIXES.some((blocked) => mime === blocked || mime.startsWith(`${blocked}+`))
}

/**
 * Returns an error message if the upload is not allowed, otherwise null.
 * Blocks executables, scripts, HTML/JS/SVG, and archives (including disguised multi-ext names).
 */
export function getUploadRejectionReason(
  filename: string,
  mimeType?: string | null
): string | null {
  const name = (filename.split(/[/\\]/).pop() || filename).trim()
  if (!name || name === '.' || name.includes('\0')) {
    return 'Invalid filename'
  }

  const extensions = getAllExtensions(name)
  if (extensions.length === 0) {
    return 'File must have a valid extension'
  }

  for (const ext of extensions) {
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return 'Executable, script, web, or archive files are not allowed'
    }
  }

  const finalExt = extensions[extensions.length - 1]!
  if (!(ALLOWED_FILE_EXTENSIONS as readonly string[]).includes(finalExt)) {
    return `Allowed types: ${ALLOWED_FILE_EXTENSIONS.join(', ').toUpperCase()}`
  }

  if (mimeType) {
    const mime = mimeType.toLowerCase().split(';')[0]!.trim()
    if (mime && mime !== 'application/octet-stream') {
      if (ALLOWED_MIME_TYPES.has(mime)) {
        // ok
      } else if (
        (mime === 'application/zip' || mime === 'application/x-zip-compressed') &&
        ZIP_BASED_EXTENSIONS.has(finalExt)
      ) {
        // ok — zip-based document formats
      } else if (isBlockedMime(mime)) {
        return 'This file type is not allowed (script, executable, or archive content)'
      } else {
        return 'File type does not match an allowed document or media format'
      }
    }
  }

  return null
}

export function isAllowedUpload(filename: string, mimeType?: string | null): boolean {
  return getUploadRejectionReason(filename, mimeType) === null
}

export function resolveMimeType(filename: string, mimeType?: string | null): string {
  if (mimeType && mimeType !== 'application/octet-stream') {
    return mimeType.toLowerCase().split(';')[0]!.trim()
  }
  const ext = getExtension(filename)
  return EXT_MIME_FALLBACK[ext] || 'application/octet-stream'
}

/**
 * Sniff the first bytes of an uploaded object to catch renamed HTML/JS/executables.
 * Call after a successful presigned PUT (confirm step).
 */
export function sniffForbiddenContent(head: Buffer, expectedExt: string): string | null {
  if (!head.length) return 'Empty file'

  // Strip UTF-8 BOM for text sniffing
  let start = 0
  if (head.length >= 3 && head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) start = 3

  const sample = head.subarray(start, Math.min(head.length, start + 512))
  const asLatin1 = sample.toString('latin1')
  const asLower = asLatin1.toLowerCase()

  // PE / Windows executable
  if (head[0] === 0x4d && head[1] === 0x5a) {
    return 'Executable files are not allowed'
  }
  // ELF
  if (head[0] === 0x7f && head[1] === 0x45 && head[2] === 0x4c && head[3] === 0x46) {
    return 'Executable files are not allowed'
  }
  // Mach-O
  if (
    (head[0] === 0xfe && head[1] === 0xed && head[2] === 0xfa) ||
    (head[0] === 0xcf && head[1] === 0xfa && head[2] === 0xed && head[3] === 0xfe)
  ) {
    return 'Executable files are not allowed'
  }
  // Shebang scripts
  if (asLatin1.startsWith('#!')) {
    return 'Script files are not allowed'
  }

  // HTML / JS / SVG served as documents
  const looksLikeHtml =
    asLower.includes('<!doctype html') ||
    asLower.includes('<html') ||
    asLower.includes('<script') ||
    asLower.includes('<svg')
  if (looksLikeHtml) {
    return 'HTML, SVG, or JavaScript content is not allowed'
  }

  // Common JS module/prologue patterns — never valid for allowed media/docs
  if (
    /^\s*(\/\*|\/\/|"use strict"|'use strict'|import\s+|export\s+|function\s+|const\s+|let\s+|var\s+)/.test(
      asLatin1
    )
  ) {
    return 'JavaScript content is not allowed'
  }

  // Magic-byte checks for declared type
  const ext = expectedExt.toLowerCase()
  if (ext === 'pdf') {
    if (!asLatin1.includes('%PDF')) {
      return 'File content does not look like a PDF'
    }
  } else if (ext === 'mp4') {
    // ISO BMFF: bytes 4..7 often 'ftyp'
    const ftyp = head.subarray(4, 8).toString('latin1')
    if (ftyp !== 'ftyp') {
      return 'File content does not look like an MP4'
    }
  } else if (ext === 'mp3') {
    const hasId3 = asLatin1.startsWith('ID3')
    const hasFrameSync = head[0] === 0xff && (head[1]! & 0xe0) === 0xe0
    if (!hasId3 && !hasFrameSync) {
      return 'File content does not look like an MP3'
    }
  } else if (['docx', 'pptx', 'xlsx'].includes(ext)) {
    // OOXML is a ZIP container (PK..)
    if (!(head[0] === 0x50 && head[1] === 0x4b)) {
      return 'File content does not look like an Office document'
    }
  } else if (ext === 'epub') {
    // EPUB is a ZIP; spec puts uncompressed mimetype as first entry
    if (!(head[0] === 0x50 && head[1] === 0x4b)) {
      return 'File content does not look like an EPUB'
    }
    if (!asLatin1.includes('application/epub+zip')) {
      return 'File content does not look like an EPUB'
    }
  } else if (['doc', 'ppt', 'xls'].includes(ext)) {
    // OLE Compound File
    if (
      !(
        head[0] === 0xd0 &&
        head[1] === 0xcf &&
        head[2] === 0x11 &&
        head[3] === 0xe0
      )
    ) {
      return 'File content does not look like an Office document'
    }
  }

  return null
}

export function fileTypeLabel(mimeType?: string | null, filename?: string | null): string {
  const ext = filename ? getExtension(filename) : ''
  if (ext) return ext.toUpperCase()
  if (!mimeType) return 'FILE'
  if (mimeType.includes('pdf')) return 'PDF'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'PPT'
  if (mimeType.includes('word') || mimeType.includes('msword')) return 'DOC'
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'XLS'
  if (mimeType.includes('epub')) return 'EPUB'
  if (mimeType.startsWith('audio/')) return 'MP3'
  if (mimeType.startsWith('video/')) return 'MP4'
  return 'FILE'
}

export function isSafePublicUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    // Block obvious script URLs even if somehow normalized
    if (parsed.username || parsed.password) return false
    return true
  } catch {
    return false
  }
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Truncate title to files.title varchar(64) */
export function truncateTitle(title: string, max = 64): string {
  const t = title.trim()
  return t.length <= max ? t : t.slice(0, max)
}
