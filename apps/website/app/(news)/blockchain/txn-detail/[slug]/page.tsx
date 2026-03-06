import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db, eq, and, ne, lte, desc, releases, blockchain, aiJobs } from '@/lib/db'
import { formatDateForSitemap, getDateline, newsUrl } from '@/lib/utils'
import { PressRelease, Takeaways } from '@/types/Release'

import { headers } from 'next/headers'
import { postESGeneric } from '@/lib/elastic'
import { PageStatsType } from '@/types/Stats'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // read route params
  const { slug: pruuid } = await params

  // fetch data
  const release = (await db.query.releases.findFirst({
    columns: {
      id: true,
      title: true,
      uuid: true,
      companyId: true,
      slug: true,
      abstract: true,
    },
    with: {
      banner: {
        columns: {
          cdnUrl: true,
        },
      },
    },
    where: and(
      eq(releases.isDeleted, false),
      eq(releases.uuid, pruuid),
    ),
  })) as PressRelease | null

  if (!release) {
    return notFound()
  }

  const cdn_url =
    release.banner?.cdnUrl!.replace(
      'resize=width:328',
      'resize=width:1200'
    ) ?? ''

  return {
    title: `Blockchain Record for ${release.title}`,
    description: `Newsworthy.ai registers all news on the blockchain for your safety. This is the blockchain transaction record for this press release. ${release.title}`,
    openGraph: {
      images: [cdn_url],
      title: `Blockchain Record for ${release.title}`,
      description: `Newsworthy.ai registers all news on the blockchain for your safety. This is the blockchain transaction record for this press release. ${release.title}`,
    },
  }
}

export default async function BlockchainPage({ params }: Props) {
  const { slug: pruuid } = await params

  const bc = await db.query.blockchain.findFirst({
    columns: {
      id: true,
      pruuid: true,
      prid: true,
      userId: true,
      chain: true,
      contract: true,
      txid: true,
      account: true,
      fingerprint: true,
      qrcode: true,
      createdAt: true,
    },
    where: eq(blockchain.pruuid, pruuid),
  })

  if (!bc) {
    return notFound()
  }

  const currentDatetime = new Date()

  // these are the pr. values you can use
  const release = (await db.query.releases.findFirst({
    columns: {
      id: true,
      title: true,
      selfHost: true,
      uuid: true,
      companyId: true,
      location: true,
      userId: true,
      slug: true,
      releasedAt: true,
      timezone: true,
      abstract: true,
    },
    with: {
      company: {
        columns: {
          companyName: true,
        },
      },
    },
    where: and(
      eq(releases.isDeleted, false),
      eq(releases.id, bc.prid),
    ),
  })) as PressRelease | null

  const pr: PressRelease | undefined = release ?? undefined

  // https://www.npmjs.com/package/@sanity/image-url

  if (!pr) {
    return notFound()
  }

  // create a dateline value if you want to use it
  const dateline = getDateline(
    pr.releaseAt,
    pr.location ?? 'Unknown Location',
    pr.timezone ?? 'Unknown Timezone'
  )

  // if you want to include a other press releases from this company section, use recent...
  const recent = (await db.query.releases.findMany({
    limit: 8,
    columns: {
      id: true,
      title: true,
      abstract: true,
      selfHost: true,
      location: true,
      slug: true,
      releasedAt: true,
      releaseAt: true,
      timezone: true,
      status: true,
    },
    where: and(
      eq(releases.isDeleted, false),
      eq(releases.companyId, pr.companyId),
      lte(releases.releasedAt, currentDatetime),
      ne(releases.id, pr.id),
    ),
    orderBy: desc(releases.releasedAt),
  })) as PressRelease[] | null

  // here are the takeaways, it might be nice to include them.
  const ai_content = (await db.query.aiJobs.findFirst({
    columns: {
      takeaway1: true,
      takeaway2: true,
      takeaway3: true,
    },
    where: eq(aiJobs.prId, bc.prid),
  })) as Takeaways | null

  const takeaway1 = ai_content?.takeaway1 ?? ''
  const takeaway2 = ai_content?.takeaway2 ?? ''
  const takeaway3 = ai_content?.takeaway3 ?? ''

  const headersList = await headers()
  const referrer = headersList.get('referer')
  const visitor_ip =
    headersList.get('x-forwarded-for') || headersList.get('remote_addr')
  const visitor_ua = headersList.get('user-agent')
  const user_platform = headersList.get('sec-ch-ua-platform')

  let platform = null
  if (user_platform) {
    platform = user_platform.replace(/"/g, '')
  }

  const stats: PageStatsType = {
    created_at: currentDatetime,
    request_ip: visitor_ip,
    user_agent: visitor_ua,
    referrer: referrer,
    user_platform: platform,
    pr_id: pr.id,
    pr_uuid: pr.uuid,
    pr_url: newsUrl(pr),
    pr_company_id: pr.companyId,
    pr_user_id: pr.userId,
    pr_released_at: pr.releasedAt,
  }

  postESGeneric(stats, 'nw_pageviews')

  return (
    <div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl mt-5 mb-10 px-5">
      <div className="max-w-none prose prose-h1:text-4xl prose-h1:font-semibold prose-h1:font-serif prose-h1:mb-0 prose-h2:text-2xl prose-h2:font-semibold prose-h2:mb-2 prose-h3:text-xl prose-h3:font-light prose-p:text-base">
        <h1>Blockchain Transaction Record</h1>
        <hr className="my-3" />
        <h2>
          <Link
            href={newsUrl(pr)}
            className="no-underline hover:underline hover:text-sky-600"
          >
            {pr.title}
          </Link>
        </h2>
        <h3>{pr.abstract}</h3>
        <p>
          <span className="underline">Exclusively at Newsworthy.ai</span> —
          Newsworthy registers every press release distributed through this
          service on the blockchain so that we can provide verification services
          and make features such as the self-hosting of press releases available
          to our customers. The blockchain provides an immutable record of the
          press releases issued by this service. Immutability gives readers the
          assurance that the news they are reading has not been altered from the
          source document that this service distributed. We have shifted the
          Source of Truth to the blockchain for added protection.
        </p>
        <p>
          Moving the Source of Truth to the blockchain improves transparency and
          increases trust between organizations submitting news and readers.
        </p>
      </div>
      <div className="prose max-w-5xl bg-yellow-700/5 rounded-lg my-4 px-5 py-5">
        <h3>Key Takeaways (TLDR)</h3>
        <ul>
          <li>{takeaway1}</li>
          <li>{takeaway2}</li>
          <li>{takeaway3}</li>
        </ul>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-base w-[350px] lg:w-[250px]">
              Blockchain
            </TableHead>
            <TableHead className="text-base">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="text-base font-bold">Chain</TableCell>
            <TableCell className="text-base">{bc.chain}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="text-base font-bold">
              Transaction ID
            </TableCell>
            <TableCell className="text-base text-sky-600 hover:underline">
              <a href={`https://polygonscan.com/tx/${bc.txid}`} target="_blank">
                {bc.txid}
              </a>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="text-base font-bold">
              Contract Address
            </TableCell>
            <TableCell className="text-base ">{bc.contract}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="text-base font-bold">
              NWAI Digital Fingerprint
            </TableCell>
            <TableCell className="text-base ">{bc.fingerprint}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="text-base font-bold">
              Registration Timestamp
            </TableCell>
            <TableCell className="text-base ">
              {formatDateForSitemap(bc.createdAt!)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      {recent && recent.length > 0 ? (
        <div className="mt-5">
          <h3 className="font-semibold text-lg">
            Other Recent Blockchain Registered News for{' '}
            {pr.company.companyName}
          </h3>
          <hr />
          <ul className="ml-5 pt-2">
            {recent.map((release) => (
              <li className="list-disc py-2" key={release?.slug}>
                <Link
                  className="hover:underline hover:text-sky-600 text-sky-700 font-semibold"
                  href={newsUrl(release)}
                >
                  {release?.title}
                </Link>{' '}
                {getDateline(
                  release?.releasedAt!,
                  release.location!,
                  release.timezone!
                )}{' '}
                {release?.abstract}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        // JSX to output when recent is falsy (null or undefined)
        <div className="prose prose-p:text-base mt-5">
          <p>
            <span className="font-semibold">{pr.company.companyName}</span>{' '}
            does not have any other recent news to report at this time.
          </p>
        </div>
      )}
    </div>
  )
}
