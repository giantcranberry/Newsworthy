#!/usr/bin/env bun
/**
 * Batch AI grounding check for releases released between 12h and 72h ago.
 *
 * For each eligible PR:
 *   1. gpt-4o-mini invents a unique search query
 *   2. For EACH provider: skip only if that (pr_id, source, query) already hit
 *   3. Run all configured providers and report each
 *   4. On success per provider, INSERT (failures are not stored)
 *
 * Usage:
 *   bun workers/grounding_check/run_batch.ts
 *   bun workers/grounding_check/run_batch.ts --limit 10 --dry-run
 *   bun workers/grounding_check/run_batch.ts --providers google,openai,perplexity
 *
 * Requires: OPENAI_KEY, SERPAPI_API_KEY (AI Overviews), DIRECT_DATABASE_URL,
 * plus PERPLEXITY_API_KEY if using perplexity.
 * Apply SQL: apps/dashboard/drizzle/manual/2026-08-26-release-grounding.sql
 * If you already created the old unique index, also run:
 *   apps/dashboard/drizzle/manual/2026-08-26-release-grounding-per-source.sql
 */

import postgres from 'postgres'
import {
  type ProviderId,
  PROVIDER_RUNNERS,
  DEFAULT_PROVIDERS,
  parseProviderList,
  deviseUniqueQuery,
  env,
} from './lib'

function parseArgs(argv: string[]) {
  const out: {
    limit: number
    dryRun: boolean
    providers: ProviderId[]
  } = {
    limit: 25,
    dryRun: false,
    providers: [...DEFAULT_PROVIDERS],
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--limit') out.limit = Math.max(1, Number(argv[++i]) || 25)
    else if (a === '--dry-run') out.dryRun = true
    else if (a === '--providers') out.providers = parseProviderList(argv[++i])
    else if (a === '--help' || a === '-h') {
      console.log(`Usage:
  bun workers/grounding_check/run_batch.ts [--limit 25] [--dry-run] [--providers google_ai_overview,openai,perplexity]
  Alias: google → google_ai_overview (SerpApi AI Overviews)`)
      process.exit(0)
    }
  }
  return out
}

type ReleaseRow = {
  id: number
  title: string
  slug: string
  abstract: string | null
  body: string | null
  released_at: Date
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dbUrl = env('DIRECT_DATABASE_URL', 'DATABASE_URL')
  if (!dbUrl) throw new Error('DIRECT_DATABASE_URL (or DATABASE_URL) is required')
  if (!env('OPENAI_KEY', 'OPENAI_API_KEY')) {
    throw new Error('OPENAI_KEY is required (gpt-4o-mini query invent + optional openai search)')
  }

  const sql = postgres(dbUrl, { max: 1, prepare: false })
  const now = Date.now()
  const minAge = new Date(now - 72 * 60 * 60 * 1000)
  const maxAge = new Date(now - 12 * 60 * 60 * 1000)

  console.log(
    `Eligible window: released_at > ${minAge.toISOString()} AND < ${maxAge.toISOString()}`,
  )
  console.log(`Providers: ${args.providers.join(', ')}  limit=${args.limit}  dryRun=${args.dryRun}`)

  try {
    const releases = await sql<ReleaseRow[]>`
      SELECT id, title, slug, abstract, body, released_at
      FROM releases
      WHERE status = 'sent'
        AND COALESCE(is_deleted, false) = false
        AND released_at IS NOT NULL
        AND title IS NOT NULL
        AND slug IS NOT NULL
        AND released_at > ${minAge}
        AND released_at < ${maxAge}
      ORDER BY released_at DESC
      LIMIT ${args.limit}
    `

    console.log(`Found ${releases.length} release(s)`)

    let stored = 0
    let skippedExisting = 0
    let hits = 0
    let misses = 0

    for (const release of releases) {
      console.log(`\n--- PR ${release.id}: ${release.title}`)

      // Google AI Overviews track the headline customers search; other providers
      // get a 4o-mini distinctive query from DB title/abstract/body.
      const titleQuery = release.title.trim()
      let inventedQuery = titleQuery
      const needsInvented = args.providers.some((p) => p !== 'google_ai_overview')
      if (needsInvented) {
        try {
          inventedQuery = await deviseUniqueQuery({
            title: release.title,
            abstract: release.abstract,
            body: release.body,
          })
        } catch (err) {
          console.log(
            `    query invent failed (non-google will use title): ${err instanceof Error ? err.message : err}`,
          )
          inventedQuery = titleQuery
        }
      }

      let anyHit = false
      for (const provider of args.providers) {
        const groundingQuery =
          provider === 'google_ai_overview' ? titleQuery : inventedQuery
        console.log(`    ${provider} query: ${groundingQuery}`)

        const existing = await sql<{ id: number }[]>`
          SELECT id
          FROM release_grounding
          WHERE pr_id = ${release.id}
            AND grounding_source = ${provider}
            AND grounding_query = ${groundingQuery}
          LIMIT 1
        `
        if (existing.length) {
          skippedExisting++
          anyHit = true
          console.log(`    ${provider}: skip (already stored id=${existing[0]!.id})`)
          continue
        }

        const result = await PROVIDER_RUNNERS[provider](groundingQuery)
        if (result.skipped) {
          console.log(`    ${provider}: skip (${result.skipReason})`)
          continue
        }
        if (!result.ok) {
          console.log(`    ${provider}: error ${result.error}`)
          continue
        }
        if (!result.grounded) {
          misses++
          console.log(`    ${provider}: miss`)
          continue
        }

        hits++
        anyHit = true
        console.log(`    ${provider}: HIT`)
        for (const u of result.positiveHits.slice(0, 5)) {
          console.log(`      + ${u}`)
        }

        if (args.dryRun) {
          console.log(`    ${provider}: dry-run not inserting`)
          continue
        }

        const inserted = await sql<{ id: number }[]>`
          INSERT INTO release_grounding (pr_id, grounding_source, grounding_query, created_at)
          VALUES (${release.id}, ${provider}, ${groundingQuery}, now())
          ON CONFLICT (pr_id, grounding_source, grounding_query) DO NOTHING
          RETURNING id
        `
        if (inserted.length) {
          stored++
          console.log(`    ${provider}: stored id=${inserted[0]!.id}`)
        } else {
          skippedExisting++
          console.log(`    ${provider}: conflict (already present)`)
        }
      }

      if (!anyHit) {
        console.log('    (no provider hits this run)')
      }
    }

    console.log(
      `\nDone. stored=${stored} hits=${hits} misses=${misses} skippedExisting=${skippedExisting}`,
    )
  } finally {
    await sql.end({ timeout: 5 })
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
