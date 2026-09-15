# Newsworthy Admin TUI

The admin dashboard, live in a terminal. It shows the same panels the web admin
page shows, refreshed on a timer instead of on a page load.

It has two tabs. Overview is the admin dashboard; Analytics is the admin
analytics page.

| Overview panel | Mirrors |
| --- | --- |
| Sales | Today, week, month and year to date with the previous period underneath |
| Today's payments | Every payment taken today, linked into the Stripe dashboard |
| Activity over time | The 30/90-day revenue bar chart and transaction line |
| Outstanding invoices | Open Stripe invoices from the last 30 days |
| Platform stats | Users, releases, companies, partners, releases awaiting approval |
| Recent signups | The newest registrations, with company and verification state |
| Editorial review queue | Releases in `review`, with editor and schedule |
| Favorite users | The signed-in admin's starred users |

| Analytics panel | Shows |
| --- | --- |
| Right now | Live users, live pages and live locations |
| Properties | Every GA4 property, with users, sessions and views for the range |
| Property detail | Totals, a users and page-views trend, channels and top pages |

Focus a single property with `n` and the live panels narrow to it, the way the
web page's detail view does. Each property row carries a shaded bar scaled to
its share of the busiest property's users, and the shading alternates, so a row
can be followed across to the far column.

Everything is read-only. The database queries are the same ones behind
`apps/dashboard/src/app/(dashboard)/admin/page.tsx`, the Stripe logic is a port
of `apps/dashboard/src/app/api/admin/sales/route.ts`, and the analytics tab
imports `apps/dashboard/src/lib/google-analytics.ts` directly rather than
keeping a second copy of the GA4 queries in sync.

## Running it

```sh
bun run apps/tui/index.ts
# or
apps/tui/bin/newsworthy-tui
```

The launcher script falls back to `doppler run --project newsworthy-dashboard
--config dev` when no database URL is in the environment and the Doppler CLI is
installed.

### Options

```
-e, --admin-email <email>   Admin whose favorite users are shown
    --db-interval <sec>     Database poll interval, default 15
    --sales-interval <sec>  Stripe poll interval, default 60
    --ga-interval <sec>     Google Analytics poll interval, default 60
    --queue-limit <n>       Review-queue rows to load, default 50
    --signup-limit <n>      Recent-signup rows to load, default 15
    --tab <name>            Tab to open on: overview or analytics
    --max-width <n>         Cap the layout width, default 200
    --env-file <path>       Extra dotenv file to load first
    --once                  Print one frame and exit
```

Analytics polls only while its tab is on screen, and `--once` fetches it only
when `--tab analytics` asked for it, so the tab costs nothing while it is out
of sight.

### Keys

| Key | Action |
| --- | --- |
| `q`, `Ctrl-C` | Quit |
| `Tab`, `1` `2` | Switch tabs |
| `r` | Refresh the active tab now |
| `R` | Rebuild the Stripe history and rediscover GA properties |
| `j` `k`, arrows | Scroll |
| `PgUp` `PgDn`, space | Scroll a screen |
| `g` `G` | Top, bottom |
| `d` | Cycle the active tab's date range |
| `?` | Help |

On Overview, `3` and `9` set the chart range and `s t a i p u e f` jump to Sales,
Activity, Invoices, Platform stats, Signups, the review queue and Favorites,
and `t` jumps to today's payments. On
Analytics, `n` and `N` step through properties, `0` goes back to all of them,
and `l o t c p` jump to Live, Properties, Totals, Channels and Pages.

## Environment

| Variable | Purpose |
| --- | --- |
| `DIRECT_DATABASE_URL` or `DATABASE_URL` | Required |
| `STRIPE_SECRET` | Required for the sales, chart and invoice panels |
| `GA_CLIENT_EMAIL` and `GA_PRIVATE_KEY` | Required for the Analytics tab |
| `GA_PROPERTIES`, `GA_PROPERTIES_EXCLUDE` | Optional property allow and deny lists |
| `NEWSWORTHY_ADMIN_EMAIL` | Default for `--admin-email` |

Values already in the environment always win. Otherwise the first file that
defines a key is used, in this order: `apps/tui/.env.local`, `apps/tui/.env`,
`<repo>/.env.local`, `<repo>/.env`, `apps/dashboard/.env.local`,
`apps/dashboard/.env`. Local `.env` files under `apps/tui` are gitignored.

## How the live refresh stays cheap

The web route recomputes every period from Stripe behind a two-hour cache. That
is too slow to feel live and too expensive to run every minute, so this app
keeps the raw charge and out-of-band payment events in memory instead.

On startup it pulls everything back to the start of last year, which is the
earliest boundary any period card needs, and takes about ten seconds. After
that each poll only fetches charges from the last half hour and paid invoices
from the last 45 days, then re-sums every period locally. A refetched window
replaces its slice of the store wholesale, so a refund inside that window drops
out correctly.

Refunds and payments against older records only surface on a full rebuild. That
happens on startup, on `R`, and automatically every 30 minutes.

Today's payments panel lists each charge and manually recorded invoice payment
taken since midnight. The customer cell and the link column are terminal
hyperlinks to that payment in the Stripe dashboard, so a click opens it;
terminals without hyperlink support still show the URL whenever the window is
wide enough to print one in full.

Payments recorded outside Stripe count towards every period card and the chart
alongside card charges. A period card names the out-of-band share underneath
its total, and the chart draws it as a green segment stacked on the blue card
revenue for that day, so a day paid entirely by invoice is a green bar.

## Installing on an Omarchy machine

On a machine that already has the repo checked out:

```sh
./apps/tui/omarchy/install.sh                 # launcher entry + a free keybinding
./apps/tui/omarchy/install.sh --no-keybind    # launcher entry only
./apps/tui/omarchy/install.sh --key "SUPER + ALT + M"
./apps/tui/omarchy/install.sh --uninstall
```

It picks the first keybinding nothing else claims, asking the running
compositor through `hyprctl binds` and falling back to reading the config files
when Hyprland is not running. Candidates are `SUPER + ALT` with N, I, A, D, M or
P, then `SUPER + CTRL + SHIFT + N`. The block it adds to `bindings.lua` is fenced
with markers, so re-running replaces it instead of stacking copies, and the file
is backed up before every edit. If a requested key turns out to be taken, the
previous binding is put back before the script exits.

The entry runs the TUI through `omarchy-launch-or-focus-tui`, so pressing the
key again focuses the existing window rather than opening another one.

### Another machine that has nothing yet

Copy one file over and run it. Nothing has to exist on the far side first, not
even a checkout:

```sh
scp apps/tui/omarchy/bootstrap.sh other-machine:
ssh -t other-machine ./bootstrap.sh
```

Use `ssh -t`. The script asks for credentials and for a sudo password when it
installs packages, and without a terminal it stops rather than guessing.

It installs `git` and `bun` through `omarchy-pkg-add`, clones or fast-forwards
the repo, runs `bun install`, sets up credentials, installs the launcher and
keybinding, then runs the TUI once to prove it can reach Postgres and Stripe.
Every step is skipped when it is already done, so re-running it is how you
update a machine as well as how you set one up.

```
--dir <path>     Where the repo lives. Default ~/Dev/nextjs/newsworthy
--repo <url>     Clone URL. Default the giantcranberry/Newsworthy SSH remote
--branch <name>  Branch to check out. Default main
--key "<bind>"   Force a keybinding instead of picking a free one
--no-keybind     Install the launcher entry only
--doppler        Install the Doppler CLI and pull secrets from it
--skip-env       Do not ask about credentials
-y, --yes        Never prompt; fail instead of asking
```

#### What each machine needs first

| Requirement | Why | If it is missing |
| --- | --- | --- |
| Omarchy, or any Arch system with `pacman` | The installer uses `pacman` and the Omarchy launcher helpers | The script stops immediately |
| A way to clone the repo | The app runs from a checkout, not a package | Add the machine's SSH key to GitHub, or pass `--repo` with an https URL |
| A database URL and a Stripe key | Every panel reads one or the other | The script asks for them and writes `apps/tui/.env` |

Only `~/.local/share/applications` and `~/.config/hypr/bindings.lua` are
touched outside the checkout, and `bindings.lua` is backed up before each edit.

#### Doing several machines

Loop over them. Each run is independent and safe to repeat:

```sh
for host in workstation laptop studio; do
  scp apps/tui/omarchy/bootstrap.sh "$host:"
  ssh -t "$host" ./bootstrap.sh
done
```

Give every machine the same key if you want the muscle memory to carry across,
rather than letting each one pick its own free binding:

```sh
ssh -t other-machine './bootstrap.sh --key "SUPER + ALT + N"'
```

On a machine that pulls secrets from Doppler instead of a local file:

```sh
ssh -t other-machine './bootstrap.sh --doppler'
```

#### Credentials

The script takes the first source that works: an existing `apps/tui/.env`, the
repo's `.env.local`, Doppler when `--doppler` is passed, or values typed at the
prompt. Typed values are written to `apps/tui/.env` with owner-only permissions,
and that path is gitignored. Secrets are never baked into the script, so the
copy you `scp` around carries none of them.

Copying your own `.env` to another machine works too, and skips the prompts:

```sh
ssh other-machine 'mkdir -p ~/Dev/nextjs/newsworthy/apps/tui'
scp apps/tui/.env other-machine:Dev/nextjs/newsworthy/apps/tui/.env
ssh -t other-machine './bootstrap.sh'
```

#### Updating a machine later

Re-run the bootstrap script, or from a checkout on that machine:

```sh
cd ~/Dev/nextjs/newsworthy && git pull && bun install
```

The launcher runs the app straight from the checkout, so a pull is enough. The
keybinding and desktop entry only need reinstalling if they were removed.

#### When something goes wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Clone failed` | The machine has no SSH key on GitHub | Add one, or re-run with `--repo https://github.com/giantcranberry/Newsworthy.git` |
| `This installer is for Arch-based Omarchy systems` | No `pacman` | The TUI still runs by hand there; only the launcher install is Arch-only |
| `is needed but there is no terminal to ask on` | Ran without `ssh -t` | Re-run with `-t`, or pre-place `apps/tui/.env` |
| `The TUI could not fetch data` | Wrong or missing credentials | Fix `apps/tui/.env` on that machine and re-run |
| The keybinding does nothing | Hyprland has not reloaded | `hyprctl reload`, or log out and back in |

To remove it from a machine:

```sh
ssh other-machine '~/Dev/nextjs/newsworthy/apps/tui/omarchy/install.sh --uninstall'
```

## Deployment

This app is terminal-only and is excluded from Vercel by the repository's
`.vercelignore`, by `apps/tui/.vercelignore`, and by an `ignoreCommand` in
`apps/tui/vercel.json`. It also has no `build` script, so `turbo build` skips
it.
