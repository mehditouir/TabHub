import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getConfig, setConfig } from '@/lib/api/config'

const inputCls = 'rounded border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand'

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
type DayKey = typeof DAY_KEYS[number]

interface DayHours { open: string; close: string }
type OpeningHours = Partial<Record<DayKey, DayHours | null>>

export function Config() {
  const { t } = useTranslation()

  const [restaurantName, setRestaurantName] = useState('')
  const [tvaRate,        setTvaRate]        = useState('19')
  const [language,       setLanguage]       = useState('FR')
  const [hours,          setHours]          = useState<OpeningHours>({})
  const [loading,        setLoading]        = useState(true)
  const [saved,          setSaved]          = useState(false)
  const [saving,         setSaving]         = useState(false)

  useEffect(() => {
    getConfig()
      .then(cfg => {
        setRestaurantName(cfg['restaurant_name'] ?? '')
        setTvaRate(cfg['tva_rate'] ?? '19')
        setLanguage(cfg['language'] ?? 'FR')
        if (cfg['opening_hours']) {
          try { setHours(JSON.parse(cfg['opening_hours'])) }
          catch { /* ignore malformed */ }
        } else {
          // default: Mon–Fri 08:00–22:00
          const defaultHours: OpeningHours = {}
          for (const d of DAY_KEYS) {
            defaultHours[d] = ['sat', 'sun'].includes(d) ? null : { open: '08:00', close: '22:00' }
          }
          setHours(defaultHours)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function setDayHours(day: DayKey, field: keyof DayHours, value: string) {
    setHours(prev => ({
      ...prev,
      [day]: { ...(prev[day] ?? { open: '08:00', close: '22:00' }), [field]: value },
    }))
  }

  function toggleDay(day: DayKey, isOpen: boolean) {
    setHours(prev => ({
      ...prev,
      [day]: isOpen ? { open: '08:00', close: '22:00' } : null,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await Promise.all([
        setConfig('restaurant_name', restaurantName),
        setConfig('tva_rate', tvaRate),
        setConfig('language', language),
        setConfig('opening_hours', JSON.stringify(hours)),
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-zinc-500">{t('common.loading')}</div>

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 max-w-xl">
      <h1 className="text-2xl font-bold text-zinc-900">{t('config.title')}</h1>

      {/* General */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {t('config.restaurantName')}
          <input
            data-testid="input-restaurant-name"
            className={inputCls}
            value={restaurantName}
            onChange={e => setRestaurantName(e.target.value)}
            maxLength={100}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t('config.tvaRate')}
          <input
            data-testid="input-tva-rate"
            type="number" min={0} max={100} step={0.01}
            className={inputCls}
            value={tvaRate}
            onChange={e => setTvaRate(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {t('config.language')}
          <select
            className={inputCls}
            value={language}
            onChange={e => setLanguage(e.target.value)}
          >
            <option value="FR">Français</option>
            <option value="AR">العربية</option>
            <option value="EN">English</option>
          </select>
        </label>
      </section>

      {/* Opening hours */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-col gap-3">
        <h2 className="font-semibold text-zinc-900">{t('config.openingHours')}</h2>
        {DAY_KEYS.map(day => {
          const dayHours = hours[day]
          const isOpen   = dayHours != null
          return (
            <div key={day} className="flex items-center gap-3 text-sm">
              <span className="w-24 font-medium text-zinc-700">{t(`config.days.${day}`)}</span>
              <label className="flex items-center gap-1.5 text-zinc-500">
                <input
                  type="checkbox"
                  checked={isOpen}
                  onChange={e => toggleDay(day, e.target.checked)}
                />
                {isOpen ? t('config.open') : t('config.closed')}
              </label>
              {isOpen && (
                <>
                  <label className="flex items-center gap-1.5 text-zinc-500">
                    {t('config.opens')}
                    <input
                      type="time"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand"
                      value={dayHours.open}
                      onChange={e => setDayHours(day, 'open', e.target.value)}
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-zinc-500">
                    {t('config.closes')}
                    <input
                      type="time"
                      className="rounded border border-zinc-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand"
                      value={dayHours.close}
                      onChange={e => setDayHours(day, 'close', e.target.value)}
                    />
                  </label>
                </>
              )}
            </div>
          )
        })}
      </section>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          data-testid="btn-save"
          disabled={saving}
          className="rounded-lg bg-brand px-6 py-2 text-sm text-white disabled:opacity-60 hover:bg-brand/80"
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
        {saved && (
          <span className="text-sm text-green-600">{t('config.saved')}</span>
        )}
      </div>
    </form>
  )
}
