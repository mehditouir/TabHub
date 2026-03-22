import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getOrderSummary, getTopItems, getRevenue } from '@/lib/api/reports'
import { formatPrice } from '@/lib/utils'
import type { OrderSummary, TopItem, RevenueReport } from '@/lib/types'

export function Dashboard() {
  const { t } = useTranslation()
  const [summary,  setSummary]  = useState<OrderSummary | null>(null)
  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [revenue,  setRevenue]  = useState<RevenueReport | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    Promise.all([getOrderSummary(), getTopItems(5), getRevenue()])
      .then(([s, t, r]) => { setSummary(s); setTopItems(t); setRevenue(r) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-zinc-500">{t('common.loading')}</div>

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">{t('dashboard.title')}</h1>

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
