'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, TrendingUp, MousePointerClick, Eye, DollarSign, Clock, CheckCircle2, XCircle, AlertTriangle, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdCampaign {
  uuid: string
  status: string
  budgetAmount: number
  amountSpent: string | number
  impressions: number
  clicks: number
  headlines: Array<{ text: string }> | null
  descriptions: Array<{ text: string }> | null
  keywords: Array<{ text: string; matchType: string }> | null
  finalUrl: string | null
  policyStatus: string | null
  policyTopics: any[] | null
  campaignStartDate: string | null
  campaignEndDate: string | null
  createdAt: string
}

interface AdCampaignCardProps {
  releaseUuid: string
  isEditorial?: boolean
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30', icon: <Clock className="h-4 w-4" /> },
  creating: { label: 'Creating', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30', icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  review: { label: 'Under Review', color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30', icon: <Clock className="h-4 w-4" /> },
  active: { label: 'Active', color: 'text-green-600 bg-green-50 dark:bg-green-950/30', icon: <TrendingUp className="h-4 w-4" /> },
  paused: { label: 'Paused', color: 'text-gray-600 bg-gray-50 dark:bg-gray-950/30', icon: <Pause className="h-4 w-4" /> },
  completed: { label: 'Completed', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30', icon: <CheckCircle2 className="h-4 w-4" /> },
  failed: { label: 'Failed', color: 'text-red-600 bg-red-50 dark:bg-red-950/30', icon: <XCircle className="h-4 w-4" /> },
  disapproved: { label: 'Disapproved', color: 'text-red-600 bg-red-50 dark:bg-red-950/30', icon: <AlertTriangle className="h-4 w-4" /> },
}

export function AdCampaignCard({ releaseUuid, isEditorial = false }: AdCampaignCardProps) {
  const [campaign, setCampaign] = useState<AdCampaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await fetch(`/api/pr/${releaseUuid}/ads`)
      if (res.ok) {
        const data = await res.json()
        setCampaign(data.campaign)
      }
    } catch (err) {
      console.error('Failed to fetch ad campaign:', err)
    } finally {
      setLoading(false)
    }
  }, [releaseUuid])

  useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  // Auto-refresh for active/review campaigns
  useEffect(() => {
    if (!campaign || !['active', 'review', 'creating'].includes(campaign.status)) return
    const interval = setInterval(fetchCampaign, 60000) // every 60s
    return () => clearInterval(interval)
  }, [campaign?.status, fetchCampaign])

  const handleAction = async (action: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/pr/${releaseUuid}/ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        await fetchCampaign()
      }
    } catch (err) {
      console.error(`Failed to ${action} campaign:`, err)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return null
  if (!campaign) return null

  const status = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.pending
  const spent = Number(campaign.amountSpent) || 0
  const ctr = campaign.impressions > 0 ? ((campaign.clicks / campaign.impressions) * 100).toFixed(1) : '0.0'
  const budgetUsedPct = campaign.budgetAmount > 0 ? Math.min(100, (spent / campaign.budgetAmount) * 100) : 0

  return (
    <Card className="border border-purple-200/60 dark:border-purple-800/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            Google Ads Campaign
          </CardTitle>
          <span className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
            status.color
          )}>
            {status.icon}
            {status.label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <DollarSign className="h-3 w-3" />
              Budget
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
              ${campaign.budgetAmount}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <DollarSign className="h-3 w-3" />
              Spent
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
              ${spent.toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <Eye className="h-3 w-3" />
              Impressions
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
              {campaign.impressions.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <MousePointerClick className="h-3 w-3" />
              Clicks
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
              {campaign.clicks.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Budget Progress */}
        {campaign.status === 'active' && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Budget used</span>
              <span>{budgetUsedPct.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${budgetUsedPct}%` }}
              />
            </div>
          </div>
        )}

        {/* CTR */}
        {campaign.impressions > 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            CTR: <span className="font-medium text-gray-900 dark:text-gray-100">{ctr}%</span>
          </p>
        )}

        {/* Disapproval Warning */}
        {campaign.status === 'disapproved' && campaign.policyTopics && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-sm text-red-700 dark:text-red-400">
            <p className="font-medium mb-1">Ad was disapproved by Google</p>
            <ul className="list-disc list-inside text-xs space-y-0.5">
              {(campaign.policyTopics as any[]).map((topic, i) => (
                <li key={i}>{topic.topic || topic.error || JSON.stringify(topic)}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Details Toggle */}
        {campaign.headlines && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-500 p-0 h-auto"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide' : 'Show'} ad copy details
            </Button>

            {showDetails && (
              <div className="space-y-3 text-sm border-t pt-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Headlines</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(campaign.headlines as any[]).map((h, i) => (
                      <span key={i} className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-xs">
                        {h.text}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Descriptions</p>
                  {(campaign.descriptions as any[]).map((d, i) => (
                    <p key={i} className="text-xs text-gray-600 dark:text-gray-400">{d.text}</p>
                  ))}
                </div>
                {campaign.keywords && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Keywords</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(campaign.keywords as any[]).map((k, i) => (
                        <span key={i} className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded text-xs">
                          {k.text} ({k.matchType})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {campaign.finalUrl && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Landing Page</p>
                    <a href={campaign.finalUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline break-all">
                      {campaign.finalUrl}
                    </a>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Editorial Actions */}
        {isEditorial && (
          <div className="flex gap-2 pt-2 border-t">
            {campaign.status === 'pending' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction('launch')}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                Launch Campaign
              </Button>
            )}
            {campaign.status === 'active' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction('pause')}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Pause className="h-3 w-3 mr-1" />}
                Pause
              </Button>
            )}
            {campaign.status === 'paused' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction('enable')}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                Resume
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
