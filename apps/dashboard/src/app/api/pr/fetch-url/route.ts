import { getEffectiveSession } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL format
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol')
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Fetch the URL content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsworthyBot/1.0; +https://newsworthy.ai)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Page not found (404)' }, { status: 400 })
      }
      if (response.status === 403) {
        return NextResponse.json({ error: 'Access forbidden - the page may require login' }, { status: 400 })
      }
      return NextResponse.json(
        { error: `Failed to fetch page (HTTP ${response.status})` },
        { status: 400 }
      )
    }

    const html = await response.text()

    // Extract the main content from HTML
    let content = html

    // Try to extract just the body content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    if (bodyMatch) {
      content = bodyMatch[1]
    }

    // Remove script and style tags
    content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    content = content.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')

    // Remove navigation, header, footer, sidebar elements
    content = content.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    content = content.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    content = content.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    content = content.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')

    // Try to find article or main content
    const articleMatch = content.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i)

    if (articleMatch) {
      content = articleMatch[1]
    } else if (mainMatch) {
      content = mainMatch[1]
    }

    // Clean up HTML but preserve some formatting
    // Remove all attributes except href
    content = content.replace(/<(\w+)([^>]*?)>/gi, (match, tag, attrs) => {
      const hrefMatch = attrs.match(/href\s*=\s*["']([^"']+)["']/i)
      if (tag.toLowerCase() === 'a' && hrefMatch) {
        return `<${tag} href="${hrefMatch[1]}">`
      }
      return `<${tag}>`
    })

    // Convert common elements to simpler versions
    content = content.replace(/<h[1-6][^>]*>/gi, '<h3>')
    content = content.replace(/<\/h[1-6]>/gi, '</h3>')
    content = content.replace(/<div[^>]*>/gi, '<p>')
    content = content.replace(/<\/div>/gi, '</p>')

    // Remove empty tags
    content = content.replace(/<(\w+)[^>]*>\s*<\/\1>/gi, '')

    // Convert HTML entities
    content = content.replace(/&nbsp;/g, ' ')
    content = content.replace(/&amp;/g, '&')
    content = content.replace(/&lt;/g, '<')
    content = content.replace(/&gt;/g, '>')
    content = content.replace(/&quot;/g, '"')

    // Clean up whitespace
    content = content.replace(/\s+/g, ' ')
    content = content.trim()

    // Check if we got meaningful content
    const textOnly = content.replace(/<[^>]*>/g, '').trim()
    if (textOnly.length < 100) {
      return NextResponse.json(
        { error: 'Could not extract meaningful content from the page. The page may be dynamic or require JavaScript.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      content,
      url: parsedUrl.href,
    })
  } catch (error) {
    console.error('[API] Error fetching URL:', error)

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Could not connect to the URL. Please check the address and try again.' },
        { status: 400 }
      )
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch URL'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
