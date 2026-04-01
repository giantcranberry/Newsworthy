import { GoogleAdsApi, enums, ResourceNames } from 'google-ads-api'

// Lazy-initialized client to avoid build errors when env vars are missing
let _client: GoogleAdsApi | null = null

function getClient(): GoogleAdsApi {
  if (!_client) {
    _client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    })
  }
  return _client
}

function getCustomer() {
  return getClient().Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID!,
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
  })
}

export interface AdHeadline {
  text: string
}

export interface AdDescription {
  text: string
}

export interface AdKeyword {
  text: string
  matchType: 'BROAD' | 'PHRASE' | 'EXACT'
}

export interface CreateCampaignInput {
  campaignName: string
  budgetAmountUsd: number
  headlines: AdHeadline[]
  descriptions: AdDescription[]
  keywords: AdKeyword[]
  finalUrl: string
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
}

export interface CreateCampaignResult {
  campaignId: string
  adGroupId: string
  budgetId: string
}

/**
 * Creates a complete Google Ads search campaign with budget, ad group, RSA, and keywords.
 */
export async function createSearchCampaign(input: CreateCampaignInput): Promise<CreateCampaignResult> {
  const customer = getCustomer()

  // 1. Create campaign budget (total budget using CUSTOM_PERIOD)
  const budgetResult = await customer.campaignBudgets.create([
    {
      name: `Budget - ${input.campaignName}`,
      amount_micros: input.budgetAmountUsd * 1_000_000, // Convert USD to micros
      delivery_method: enums.BudgetDeliveryMethod.STANDARD,
      period: enums.BudgetPeriod.CUSTOM_PERIOD,
      total_amount_micros: input.budgetAmountUsd * 1_000_000,
    },
  ])

  const budgetResourceName = budgetResult.results[0].resource_name!
  const budgetId = budgetResourceName.split('/').pop()!

  // 2. Create campaign
  const campaignResult = await customer.campaigns.create([
    {
      name: input.campaignName,
      status: enums.CampaignStatus.PAUSED, // Start paused until ad is approved
      advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
      campaign_budget: budgetResourceName,
      start_date_time: input.startDate.replace(/-/g, ''),
      end_date_time: input.endDate.replace(/-/g, ''),
      // Maximize clicks with a CPC ceiling (target_spend = Maximize Clicks strategy)
      target_spend: {
        cpc_bid_ceiling_micros: 2_000_000, // $2.00 max CPC
      },
      // Search network only
      network_settings: {
        target_google_search: true,
        target_search_network: false,
        target_content_network: false,
      },
    },
  ])

  const campaignResourceName = campaignResult.results[0].resource_name!
  const campaignId = campaignResourceName.split('/').pop()!

  // 3. Create ad group
  const adGroupResult = await customer.adGroups.create([
    {
      name: `Ad Group - ${input.campaignName}`,
      campaign: campaignResourceName,
      status: enums.AdGroupStatus.ENABLED,
      type: enums.AdGroupType.SEARCH_STANDARD,
    },
  ])

  const adGroupResourceName = adGroupResult.results[0].resource_name!
  const adGroupId = adGroupResourceName.split('/').pop()!

  // 4. Create Responsive Search Ad (RSA) via adGroupAds
  await customer.adGroupAds.create([
    {
      ad_group: adGroupResourceName,
      ad: {
        responsive_search_ad: {
          headlines: input.headlines.map(h => ({
            text: h.text,
          })),
          descriptions: input.descriptions.map(d => ({
            text: d.text,
          })),
        },
        final_urls: [input.finalUrl],
      },
      status: enums.AdGroupAdStatus.ENABLED,
    },
  ])

  // 5. Create keywords
  const keywordMutations = input.keywords.map(kw => ({
    ad_group: adGroupResourceName,
    keyword: {
      text: kw.text,
      match_type: enums.KeywordMatchType[kw.matchType],
    },
    status: enums.AdGroupCriterionStatus.ENABLED,
  }))

  if (keywordMutations.length > 0) {
    await customer.adGroupCriteria.create(keywordMutations)
  }

  return {
    campaignId,
    adGroupId,
    budgetId,
  }
}

/**
 * Enable a paused campaign (after ad approval).
 */
export async function enableCampaign(campaignId: string): Promise<void> {
  const customer = getCustomer()
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!

  await customer.campaigns.update([
    {
      resource_name: ResourceNames.campaign(customerId, campaignId),
      status: enums.CampaignStatus.ENABLED,
    },
  ])
}

/**
 * Pause a campaign.
 */
export async function pauseCampaign(campaignId: string): Promise<void> {
  const customer = getCustomer()
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!

  await customer.campaigns.update([
    {
      resource_name: ResourceNames.campaign(customerId, campaignId),
      status: enums.CampaignStatus.PAUSED,
    },
  ])
}

export interface AdReviewStatus {
  adId: string
  approvalStatus: string
  policyTopics: Array<{ topic: string; type: string }>
}

/**
 * Get ad review/approval status for all ads in a campaign.
 */
export async function getAdReviewStatus(campaignId: string): Promise<AdReviewStatus[]> {
  const customer = getCustomer()

  const results = await customer.query(`
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.policy_summary.approval_status,
      ad_group_ad.policy_summary.policy_topic_entries
    FROM ad_group_ad
    WHERE campaign.id = ${campaignId}
  `)

  return results.map((row: any) => ({
    adId: String(row.ad_group_ad?.ad?.id || ''),
    approvalStatus: row.ad_group_ad?.policy_summary?.approval_status || 'UNKNOWN',
    policyTopics: (row.ad_group_ad?.policy_summary?.policy_topic_entries || []).map((entry: any) => ({
      topic: entry.topic || '',
      type: entry.type || '',
    })),
  }))
}

export interface CampaignMetrics {
  impressions: number
  clicks: number
  costMicros: number
  status: string
}

/**
 * Get campaign performance metrics.
 */
export async function getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
  const customer = getCustomer()

  const results = await customer.query(`
    SELECT
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM campaign
    WHERE campaign.id = ${campaignId}
  `)

  if (results.length === 0) {
    return { impressions: 0, clicks: 0, costMicros: 0, status: 'UNKNOWN' }
  }

  const row: any = results[0]
  return {
    impressions: Number(row.metrics?.impressions || 0),
    clicks: Number(row.metrics?.clicks || 0),
    costMicros: Number(row.metrics?.cost_micros || 0),
    status: row.campaign?.status || 'UNKNOWN',
  }
}

/**
 * Remove (delete) a campaign entirely.
 */
export async function removeCampaign(campaignId: string): Promise<void> {
  const customer = getCustomer()
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!

  await customer.campaigns.update([
    {
      resource_name: ResourceNames.campaign(customerId, campaignId),
      status: enums.CampaignStatus.REMOVED,
    },
  ])
}
