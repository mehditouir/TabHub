import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getOrderSummary, getTopItems, getRevenue } from '@/lib/api/reports'
import { getSpaces } from '@/lib/api/spaces'
import { formatPrice } from '@/lib/utils'
import type { OrderSummary, TopItem, RevenueReport } from '@/lib/types'

export function Dashboard() {
  const { t }      = useTranslation()
  const { tenant } = useParams<{ tenant: string }>()
  const [summary,    setSummary]    = useState<OrderSummary | null>(null)
  const [topItems,   setTopItems]   = useState<TopItem[]>([])
  const [revenue,    setRevenue]    = useState<RevenueReport | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [hasSpaces,  setHasSpaces]  = useState(true)

  useEffect(() => {
    Promise.all([getOrderSummary(), getTopItems(5), getRevenue(), getSpaces()])
      .then(([s, top, r, spaces]) => {
        setSummary(s); setTopItems(top); setRevenue(r)
        setHasSpaces(spaces.length > 0)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-zinc-500">{t('common.loading')}</div>

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">{t('dashboard.title')}</h1>

      {/* Onboarding CTA — shown only when no spaces exist yet */}
      {!hasSpaces && (
        <div className="rounded-2xl border-2 border-dashed border-brand/40 bg-brand/5 px-8 py-8 text-center">
          <div className="mb-3 text-4xl">🚀</div>
          <h2 className="mb-2 text-xl font-bold text-zinc-900">Bienvenue sur TabHub !</h2>
          <p className="mb-6 text-sm text-zinc-600 max-w-md mx-auto">
            Votre restaurant n'est pas encore configuré. Suivez l'assistant en 4 étapes pour créer vos espaces,
            ajouter votre équipe et publier votre menu — moins de 5 minutes.
          </p>
          <Link
            to={`/manager/${tenant}/setup`}
            className="inline-block rounded-lg bg-brand px-8 py-3 text-sm font-semibold text-white hover:bg-brand/80 transition-colors"
          >
            Commencer la configuration →
          </Link>
        </div>
      )}

      {/* KPI cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              { key: 'total',      value: summary.totalOrders, color: 'zinc'   },
              { key: 'pending',    value: summary.pending,     color: 'yellow' },
              { key: 'inProgress', value: summary.inProgress,  color: 'blue'   },
              { key: 'ready',      value: summary.ready,       color: 'orange' },
              { key: 'completed',  value: summary.completed,   color: 'green'  },
              { key: 'cancelled',  value: summary.cancelled,   color: 'red'    },
            ] as const
          ).map(({ key, value, color }) => (
            <div key={key} className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
              <div className={`text-3xl font-bold text-${color}-600`}>{value}</div>
              <div className="mt-1 text-sm text-zinc-500">{t(`dashboard.${key}`)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Avg completion time */}
      {summary?.avgCompletionMinutes != null && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-sm text-zinc-500">{t('dashboard.avgCompletion')}</p>
          <p className="text-2xl font-bold text-zinc-900">{summary.avgCompletionMinutes} {t('dashboard.min')}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue (last 30 days) */}
        {revenue && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="mb-1 font-semibold text-zinc-900">{t('dashboard.revenue30')}</h2>
            <p className="mb-4 text-3xl font-bold text-brand">{formatPrice(revenue.totalRevenue)}</p>
            <div className="flex items-end gap-1" style={{ height: 80 }}>
              {revenue.byDay.map(d => {
                const max = Math.max(...revenue.byDay.map(x => x.revenue), 1)
                const pct = Math.round((d.revenue / max) * 100)
                return (
                  <div key={d.date} className="relative flex-1" title={`${d.date}: ${formatPrice(d.revenue)}`}>
                    <div
                      className="w-full rounded-t bg-brand opacity-80 hover:opacity-100 transition-opacity"
                      style={{ height: `${pct}%`, minHeight: pct > 0 ? 4 : 0 }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top items */}
        {topItems.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="mb-4 font-semibold text-zinc-900">{t('dashboard.topItems')}</h2>
            <ol className="flex flex-col gap-2">
              {topItems.map((item, i) => (
                <li key={item.menuItemId} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-center font-bold text-zinc-400">{i + 1}</span>
                  <span className="flex-1 font-medium text-zinc-800">{item.name}</span>
                  <span className="text-zinc-500">{item.totalQuantity} {t('dashboard.sold')}</span>
                  <span className="font-semibold text-zinc-700">{formatPrice(item.totalRevenue)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
