export type FeedStatsType = {
    feed_type: string
    created_at: Date
    category?: string | null
    request_ip: string | null
    user_agent: string | null
    referrer: string | null
    user_platform: string | null
    pr_ids: number[]
    pr_uuids: string[]
    feed_url: string | null
  }
  
  export type ShareStatsType = {
    created_at: Date
    request_ip: string | null
    user_agent: string | null
    referrer: string | null
    company_id: number | null
    pr_url: string | null
    pr_id: number | null
    user_id: number | null
    cohort: string | null    
  }

  export type PageStatsType = {
    created_at: Date
    request_ip: string | null
    user_agent: string | null
    referrer: string | null
    user_platform: string | null
    pr_id: number
    pr_uuid: string
    pr_url: string | null
    pr_company_id: number | null
    pr_user_id: number | null
    pr_released_at: Date | null 
  }


