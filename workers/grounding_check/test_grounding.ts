#!/usr/bin/env bun
/**
 * Manual one-off grounding probe (query or URL).
 * For the scheduled batch over recent releases, use run_batch.ts.
 *
 * Usage:
 *   bun workers/grounding_check/test_grounding.ts --query "unique phrase"
 *   bun workers/grounding_check/test_grounding.ts --url "https://www.newsworthy.ai/news/..."
 */

import postgres from 'postgres'
import {
  type ProviderId,
  PROVIDER_RUNNERS,
  DEFAULT_PROVIDERS,
  parseProviderList,
  env,
  hostnameOf,
  isPositiveCitation,
  POSITIVE_HOST_SUFFIXES,
} from './lib'

function parseArgs(argv: string[]) {
  const out: {
    query?: string
    url?: string
    providers: ProviderId[]
    checkHits: boolean
    json: boolean
  } = {
    providers: [...DEFAULT_PROVIDERS],
    checkHits: false,
    json: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--query') out.query = argv[++i]
    else if (a === '--url') out.url = argv[++i]
    else if (a === '--providers') out.providers = parseProviderList(argv[++i])
    else if (a === '--check-hits') out.checkHits = true
    else if (a === '--json') out.json = true
    else if (a === '--help' || a === '-h') {
      console.log(`Usage:
  bun workers/grounding_check/test_grounding.ts --query "..." [--providers google_ai_overview,openai,perplexity]
  bun workers/grounding_check/test_grounding.ts --url "https://www.newsworthy.ai/news/..."
  Alias: google → google_ai_overview
  Options: --check-hits  --json`)
      process.exit(0)
    }
  }
  return out
}

async function buildQueryFromUrl(url: string): Promise<string> {
  let title = ''
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'NewsworthyGroundingCheck/1.0' },
      redirect: 'follow',
    })
    const html = await res.text()
    const og = html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    )
    const t = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    title = (og?.[1] || t?.[1] || '').replace(/\s+/g, ' ').trim()
  } catch {
    // fall through
  }

  const distinctive = title ? `"${title}"` : `"${url}"`
  return [
    `Using current web search only, what is this news story about: ${distinctive}`,
    `Prefer primary sources. If you cite the web, include source URLs.`,
    `Focus on the article at ${url}`,
  ].join(' ')
}

async function checkPageHits(since: Date, relatedPath?: string) {
  const dbUrl = env('DIRECT_DATABASE_URL', 'DATABASE_URL')
  if (!dbUrl) {
    return { skipped: true as const, reason: 'No DIRECT_DATABASE_URL' }
  }

  const sql = postgres(dbUrl, { max: 1, prepare: false })
  try {
    const rows = await sql<
      {
        bot_name: string | null
        visitor: string
        path: string
        page_url: string
        created_at: Date
      }[]
    >`
      SELECT bot_name, visitor, path, page_url, created_at
      FROM page_hits
      WHERE created_at >= ${since}
        AND visitor IN ('ai', 'seo', 'other')
      ORDER BY created_at DESC
      LIMIT 50
    `
    const filtered = relatedPath
      ? rows.filter(
          (r) =>
            r.path.includes(relatedPath) ||
            r.page_url.includes(relatedPath) ||
            /newsworthy\.ai|citybuzz\.co|streetinsider\.com|finance\.yahoo\.com/i.test(
              r.page_url,
            ),
        )
      : rows
    return { skipped: false as const, rows: filtered }
  } finally {
    await sql.end({ timeout: 2 })
  }
}

function printResult(
  r: Awaited<ReturnType<(typeof PROVIDER_RUNNERS)[ProviderId]>>,
) {
  const mark = r.skipped ? 'SKIP' : r.ok ? (r.grounded ? 'HIT ' : 'MISS') : 'ERR '
  console.log(`\n=== ${r.provider.toUpperCase()} [${mark}] ===`)
  if (r.skipped) {
    console.log(`  ${r.skipReason}`)
    return
  }
  if (!r.ok) {
    console.log(`  error: ${r.error}`)
    return
  }
  console.log(`  grounded: ${r.grounded}`)
  if (r.positiveHits.length) {
    console.log('  positive citations:')
    for (const u of r.positiveHits) console.log(`    + ${u}`)
  }
  if (r.citations.length) {
    console.log(`  all citations (${r.citations.length}):`)
    for (const u of r.citations.slice(0, 20)) {
      const host = hostnameOf(u) || u
      const flag = isPositiveCitation(u) ? '+' : ' '
      console.log(`    ${flag} ${host}  ${u}`)
    }
    if (r.citations.length > 20) {
      console.log(`    … +${r.citations.length - 20} more`)
    }
  } else {
    console.log('  citations: (none parsed)')
  }
  if (r.answerPreview) console.log(`  answer: ${r.answerPreview}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  let query = args.query?.trim()

  if (!query && args.url) {
    console.log(`Building query from URL: ${args.url}`)
    query = await buildQueryFromUrl(args.url)
  }

  if (!query) {
    console.error('Provide --query "..." or --url "https://..."')
    process.exit(1)
  }

  const startedAt = new Date()
  console.log(`Query: ${query}`)
  console.log(`Providers: ${args.providers.join(', ')}`)
  console.log(
    `Positive hosts: newsworthy.ai, citybuzz.co, streetinsider.com, finance.yahoo.com`,
  )

  const results = []
  for (const id of args.providers) {
    results.push(await PROVIDER_RUNNERS[id](query))
  }

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          query,
          url: args.url ?? null,
          positiveHosts: [
            ...POSITIVE_HOST_SUFFIXES,
            'finance.yahoo.com',
            'yahoo.com/finance',
          ],
          results,
        },
        null,
        2,
      ),
    )
  } else {
    for (const r of results) printResult(r)
    const runnable = results.filter((r) => !r.skipped)
    const hits = runnable.filter((r) => r.grounded)
    console.log(
      `\nSummary: ${hits.length}/${runnable.length} providers cited a positive host` +
        (results.some((r) => r.skipped)
          ? ` (${results.filter((r) => r.skipped).length} skipped)`
          : ''),
    )
  }

  if (args.checkHits) {
    await Bun.sleep(2500)
    const pathHint = args.url ? new URL(args.url).pathname : undefined
    const hits = await checkPageHits(startedAt, pathHint)
    console.log('\n=== page_hits since test start ===')
    if (hits.skipped) {
      console.log(`  skipped: ${hits.reason}`)
    } else if (!hits.rows.length) {
      console.log('  (no matching crawler rows yet)')
    } else {
      for (const row of hits.rows) {
        console.log(
          `  ${row.created_at.toISOString()}  ${row.visitor}/${row.bot_name ?? '-'}  ${row.path}`,
        )
      }
    }
  }

  const anyError = results.some((r) => !r.skipped && !r.ok)
  process.exit(anyError ? 2 : 0)
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
