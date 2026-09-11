#!/usr/bin/env bun
/**
 * Newsworthy admin TUI.
 *
 * Environment has to be in place before `@nwai/db` is imported, because that
 * module opens its Postgres pool at import time. Everything below therefore
 * loads dotenv files first and only then imports the app. The type import
 * below is erased at build time, so it does not open that pool.
 */

import type { TabId } from './src/app.ts'

const HELP = `
Newsworthy Admin TUI — the admin dashboard, live in a terminal.

Usage
  bun run apps/tui/index.ts [options]
  apps/tui/bin/newsworthy-tui [options]

Options
  -e, --admin-email <email>   Admin whose favorite users are shown.
                              Defaults to $NEWSWORTHY_ADMIN_EMAIL.
      --db-interval <sec>     Database poll interval. Default 15.
      --sales-interval <sec>  Stripe poll interval. Default 60.
      --ga-interval <sec>     Google Analytics poll interval. Default 60.
      --queue-limit <n>       Review-queue rows to load. Default 50.
      --signup-limit <n>      Recent-signup rows to load. Default 15.
      --tab <name>            Tab to open on: overview or analytics.
      --max-width <n>         Cap the layout width. Default 200.
      --env-file <path>       Extra dotenv file to load first.
      --once                  Print one frame and exit, no full-screen UI.
  -h, --help                  Show this help.

Environment
  DIRECT_DATABASE_URL or DATABASE_URL   Required.
  STRIPE_SECRET                         Required for the sales panels.
  GA_CLIENT_EMAIL and GA_PRIVATE_KEY    Required for the Analytics tab.
  GA_PROPERTIES, GA_PROPERTIES_EXCLUDE  Optional property allow / deny lists.
  NEWSWORTHY_ADMIN_EMAIL                Optional default for --admin-email.

Values already in the environment always win. Otherwise the first of these
files that defines a key is used: apps/tui/.env.local, apps/tui/.env,
<repo>/.env.local, <repo>/.env, apps/dashboard/.env.local, apps/dashboard/.env.
Running under \`doppler run --\` works too and takes precedence over all of them.
`

interface ParsedArgs {
  adminEmail: string | null
  dbIntervalMs: number
  salesIntervalMs: number
  gaIntervalMs: number
  queueLimit: number
  signupLimit: number
  maxWidth: number
  once: boolean
  tab: TabId
  envFile: string | null
  help: boolean
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    adminEmail: null,
    dbIntervalMs: 15_000,
    salesIntervalMs: 60_000,
    gaIntervalMs: 60_000,
    queueLimit: 50,
    signupLimit: 15,
    maxWidth: 200,
    once: false,
    tab: 'overview',
    envFile: null,
    help: false,
  }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    // Accept both "--flag value" and "--flag=value".
    const equals = arg.indexOf('=')
    const name = equals === -1 ? arg : arg.slice(0, equals)
    const inlineValue = equals === -1 ? null : arg.slice(equals + 1)
    const next = () => inlineValue ?? argv[++index] ?? ''

    switch (name) {
      case '-h':
      case '--help':
        parsed.help = true
        break
      case '-e':
      case '--admin-email':
        parsed.adminEmail = next()
        break
      case '--db-interval':
        parsed.dbIntervalMs = Math.max(2, Number(next()) || 15) * 1000
        break
      case '--sales-interval':
        parsed.salesIntervalMs = Math.max(10, Number(next()) || 60) * 1000
        break
      // Realtime GA calls are quota-limited, so the floor is higher here.
      case '--ga-interval':
        parsed.gaIntervalMs = Math.max(15, Number(next()) || 60) * 1000
        break
      case '--queue-limit':
        parsed.queueLimit = Math.max(1, Number(next()) || 50)
        break
      case '--signup-limit':
        parsed.signupLimit = Math.max(1, Number(next()) || 15)
        break
      case '--tab': {
        const value = next().toLowerCase()
        if (value !== 'overview' && value !== 'analytics') {
          process.stderr.write(`Unknown tab: ${value}. Use overview or analytics.\n`)
          process.exit(2)
        }
        parsed.tab = value
        break
      }
      case '--max-width':
        parsed.maxWidth = Math.max(60, Number(next()) || 200)
        break
      case '--env-file':
        parsed.envFile = next()
        break
      case '--once':
        parsed.once = true
        break
      default:
        if (name.startsWith('-')) {
          process.stderr.write(`Unknown option: ${name}\n`)
          process.exit(2)
        }
    }
  }

  return parsed
}

/** Minimal dotenv parser: KEY=value, optional quotes, `export` prefix, # comments. */
function parseDotenv(contents: string): Record<string, string> {
  const values: Record<string, string> = {}

  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const withoutExport = line.startsWith('export ') ? line.slice(7).trim() : line
    const separator = withoutExport.indexOf('=')
    if (separator === -1) continue

    const key = withoutExport.slice(0, separator).trim()
    if (!key) continue

    let value = withoutExport.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1)
    } else {
      const comment = value.indexOf(' #')
      if (comment !== -1) value = value.slice(0, comment).trim()
    }

    values[key] = value.replace(/\\n/g, '\n')
  }

  return values
}

/** Load dotenv files without overwriting anything already in the environment. */
async function loadEnvFiles(candidates: string[]): Promise<string[]> {
  const loaded: string[] = []

  for (const path of candidates) {
    const file = Bun.file(path)
    if (!(await file.exists())) continue

    const values = parseDotenv(await file.text())
    let used = false
    for (const [key, value] of Object.entries(values)) {
      if (process.env[key] === undefined) {
        process.env[key] = value
        used = true
      }
    }
    if (used) loaded.push(path)
  }

  return loaded
}

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  process.stdout.write(HELP)
  process.exit(0)
}

const appDir = new URL('.', import.meta.url).pathname
const repoRoot = new URL('../../', import.meta.url).pathname

await loadEnvFiles([
  ...(args.envFile ? [args.envFile] : []),
  `${appDir}.env.local`,
  `${appDir}.env`,
  `${repoRoot}.env.local`,
  `${repoRoot}.env`,
  `${repoRoot}apps/dashboard/.env.local`,
  `${repoRoot}apps/dashboard/.env`,
])

if (!process.env.DIRECT_DATABASE_URL && !process.env.DATABASE_URL) {
  process.stderr.write(
    'No database connection string found.\n' +
      'Set DIRECT_DATABASE_URL or DATABASE_URL, put it in apps/tui/.env, ' +
      'or start the TUI with `doppler run -- ...`.\n',
  )
  process.exit(1)
}

const { run } = await import('./src/app.ts')

await run({
  adminEmail: args.adminEmail || process.env.NEWSWORTHY_ADMIN_EMAIL || null,
  dbIntervalMs: args.dbIntervalMs,
  salesIntervalMs: args.salesIntervalMs,
  gaIntervalMs: args.gaIntervalMs,
  queueLimit: args.queueLimit,
  signupLimit: args.signupLimit,
  maxWidth: args.maxWidth,
  once: args.once,
  tab: args.tab,
})
