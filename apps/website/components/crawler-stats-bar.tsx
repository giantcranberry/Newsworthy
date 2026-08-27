import { getCrawlerStatsLast24h } from '@/lib/crawler-stats'
import { CrawlerStatsTicker } from '@/components/crawler-stats-ticker'

export async function CrawlerStatsBar() {
  const initial = await getCrawlerStatsLast24h()

  return <CrawlerStatsTicker initial={initial} />
}
