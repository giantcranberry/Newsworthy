/**
 * Backfill script: Set company.nr_title to a unique slugified version of the
 * brand name wherever nr_title is null or empty. Uniqueness is checked
 * case-insensitively against every existing nr_title and against titles
 * assigned earlier in the same run (collisions get -2, -3, ...).
 *
 * Usage: bun scripts/backfill-nr-title.ts [--dry-run]
 *
 * --dry-run: Show what would be changed without writing to the database
 */

import slugify from 'slugify'

const dryRun = process.argv.includes('--dry-run')

const connectionString = process.env.DATABASE_URL!
if (!connectionString) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const sql = new Bun.SQL(connectionString, { prepare: false })

const MAX_LEN = 128

function uniqueSlug(name: string, taken: Set<string>): string | null {
  const base = slugify(name, { lower: true, strict: true, trim: true }).slice(0, MAX_LEN)
  if (!base) return null

  let candidate = base
  let n = 2
  while (taken.has(candidate)) {
    const suffix = `-${n++}`
    candidate = `${base.slice(0, MAX_LEN - suffix.length)}${suffix}`
  }
  taken.add(candidate)
  return candidate
}

async function main() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE RUN ===')
  console.log()

  const existing: { nr_title: string }[] = await sql`
    SELECT nr_title FROM company
    WHERE nr_title IS NOT NULL AND trim(nr_title) <> ''
  `
  const taken = new Set(existing.map((r) => r.nr_title.trim().toLowerCase()))

  const targets: { id: number; company_name: string }[] = await sql`
    SELECT id, company_name FROM company
    WHERE nr_title IS NULL OR trim(nr_title) = ''
    ORDER BY id
  `
  console.log(`${targets.length} companies with empty nr_title`)

  let updated = 0
  const skipped: typeof targets = []

  for (const co of targets) {
    const title = uniqueSlug(co.company_name, taken)
    if (!title) {
      skipped.push(co)
      continue
    }
    console.log(`  ${co.id}\t${co.company_name}\t→ ${title}`)
    if (!dryRun) {
      await sql`
        UPDATE company SET nr_title = ${title}
        WHERE id = ${co.id} AND (nr_title IS NULL OR trim(nr_title) = '')
      `
    }
    updated++
  }

  console.log()
  console.log(`${dryRun ? 'Would update' : 'Updated'}: ${updated}`)
  if (skipped.length) {
    console.log(`Skipped (name slugifies to empty): ${skipped.length}`)
    for (const co of skipped) console.log(`  ${co.id}\t${co.company_name}`)
  }

  await sql.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
