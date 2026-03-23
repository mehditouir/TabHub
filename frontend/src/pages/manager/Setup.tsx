/**
 * Onboarding wizard — shown to new restaurant owners on first login.
 * Route: /manager/:tenant/setup
 * 4 steps: Restaurant config → Spaces → Staff → Menu
 */
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { setConfig }      from '@/lib/api/config'
import { createSpace, createTable } from '@/lib/api/spaces'
import { createStaff }    from '@/lib/api/staff'
import { createCategory, createMenuItem } from '@/lib/api/menu'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface StepData {
  restaurantName: string
  tvaRate: string
  spaceName: string
  tableCount: string
  staffName: string
  staffRole: string
  staffPin: string
  categoryName: string
  itemName: string
  itemPrice: string
}

const INITIAL: StepData = {
  restaurantName: '',
  tvaRate: '19',
  spaceName: '',
  tableCount: '8',
  staffName: '',
  staffRole: 'Waiter',
  staffPin: '',
  categoryName: '',
  itemName: '',
  itemPrice: '',
}

const STEPS = ['restaurant', 'spaces', 'staff', 'menu'] as const
type Step = typeof STEPS[number]

// ── Step definitions ─────────────────────────────────────────────────────────

const STEP_META: Record<Step, { icon: string; benefit: string }> = {
  restaurant: {
    icon: '🏪',
    benefit: 'Votre nom et TVA s'affichent automatiquement sur chaque ticket imprimé et dans les rapports. Configurez-les une fois, profitez-en partout.',
  },
  spaces: {
    icon: '🗺️',
    benefit: 'Chaque espace génère des QR codes uniques pour chaque table. Vos clients scannent et commandent directement depuis leur téléphone — zéro attente, zéro erreur de commande.',
  },
  staff: {
    icon: '👤',
    benefit: 'Chaque membre de votre équipe reçoit un rôle dédié (serveur, cuisine, caisse). Ils se connectent en 2 secondes via un code PIN — pas besoin de mot de passe complexe.',
  },
  menu: {
    icon: '🍽️',
    benefit: 'Votre menu en ligne est mis à jour en temps réel. Activez ou désactivez un plat en un clic — vos clients ne voient que ce qui est disponible.',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Setup() {
  const { tenant }   = useParams<{ tenant: string }>()
  const navigate     = useNavigate()
  const { t }        = useTranslation()

  const [step,    setStep]    = useState<Step>('restaurant')
  const [data,    setData]    = useState<StepData>(INITIAL)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const stepIndex = STEPS.indexOf(step)

  function update(patch: Partial<StepData>) {
    setData(prev => ({ ...prev, ...patch }))
  }

  // ── Save each step ────────────────────────────────────────────────────────

  async function saveRestaurant() {
    await Promise.all([
      setConfig('restaurant_name', data.restaurantName),
      setConfig('tva_rate', data.tvaRate),
    ])
  }

  async function saveSpaces() {
    const space = await createSpace({
      name: data.spaceName,
      cols: 4,
      rows: Math.ceil(Number(data.tableCount) / 4),
    })
    // Create tables in a grid
    const count = Math.min(Number(data.tableCount) || 4, 20)
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        createTable({
          spaceId: space.id,
          number:  String(i + 1),
          col:     i % 4,
          row:     Math.floor(i / 4),
        })
      )
    )
  }

  async function saveStaff() {
    await createStaff({
      displayName: data.staffName,
      role:        data.staffRole,
      pin:         data.staffPin,
    })
  }

  async function saveMenu() {
    const cat = await createCategory(data.categoryName)
    await createMenuItem({
      categoryId:  cat.id,
      name:        data.itemName,
      price:       parseFloat(data.itemPrice) || 0,
    })
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  async function handleNext() {
    setSaving(true)
    setError(null)
    try {
      if (step === 'restaurant') await saveRestaurant()
      if (step === 'spaces')     await saveSpaces()
      if (step === 'staff')      await saveStaff()
      if (step === 'menu') {
        await saveMenu()
        navigate(`/manager/${tenant}/dashboard`, { replace: true })
        return
      }
      setStep(STEPS[stepIndex + 1])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setSaving(false)
    }
  }

  function handleSkip() {
    if (stepIndex < STEPS.length - 1) {
      setStep(STEPS[stepIndex + 1])
    } else {
      navigate(`/manager/${tenant}/dashboard`, { replace: true })
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const meta = STEP_META[step]

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 px-4 py-12">

      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mb-2 text-4xl font-bold text-zinc-900">TabHub</div>
        <p className="text-zinc-500">Configurez votre restaurant en 4 étapes simples</p>
      </div>

      {/* Progress bar */}
      <div className="mb-8 flex w-full max-w-lg items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex flex-1 flex-col items-center gap-1">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
              i < stepIndex  ? 'bg-green-500 text-white'
              : i === stepIndex ? 'bg-brand text-white'
              : 'bg-zinc-200 text-zinc-400'
            )}>
              {i < stepIndex ? '✓' : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('h-1 w-full rounded', i < stepIndex ? 'bg-green-400' : 'bg-zinc-200')} />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-lg">

        {/* Step header */}
        <div className="border-b border-zinc-100 px-8 py-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{meta.icon}</span>
            <div>
              <h2 className="text-xl font-bold text-zinc-900">{stepTitle(step)}</h2>
              <p className="mt-1 text-sm text-zinc-500">{t('common.step', 'Étape')} {stepIndex + 1} / {STEPS.length}</p>
            </div>
          </div>

          {/* Value proposition */}
          <div className="mt-4 rounded-lg bg-brand/5 border border-brand/20 px-4 py-3 text-sm text-zinc-700 leading-relaxed">
            💡 {meta.benefit}
          </div>
        </div>

        {/* Form fields */}
        <div className="px-8 py-6 flex flex-col gap-4">
          {step === 'restaurant' && <RestaurantStep data={data} update={update} />}
          {step === 'spaces'     && <SpacesStep     data={data} update={update} />}
          {step === 'staff'      && <StaffStep      data={data} update={update} />}
          {step === 'menu'       && <MenuStep       data={data} update={update} />}

          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-zinc-100 px-8 py-5">
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm text-zinc-400 hover:text-zinc-600 hover:underline"
          >
            Passer cette étape
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={saving || !isStepValid(step, data)}
            className="rounded-lg bg-brand px-8 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-brand/80 transition-colors"
          >
            {saving
              ? 'Enregistrement…'
              : step === 'menu' ? '🎉 Terminer la configuration' : 'Suivant →'}
          </button>
        </div>
      </div>

      {/* Skip all */}
      <button
        type="button"
        onClick={() => navigate(`/manager/${tenant}/dashboard`, { replace: true })}
        className="mt-6 text-xs text-zinc-400 hover:text-zinc-600 hover:underline"
      >
        Aller directement au tableau de bord
      </button>
    </div>
  )
}

// ── Step sub-components ───────────────────────────────────────────────────────

const inputCls = 'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand'
const labelCls = 'flex flex-col gap-1.5 text-sm font-medium text-zinc-700'

function RestaurantStep({ data, update }: { data: StepData; update: (p: Partial<StepData>) => void }) {
  return (
    <>
      <label className={labelCls}>
        Nom du restaurant
        <input
          className={inputCls}
          placeholder="ex. Chez Ahmed"
          value={data.restaurantName}
          onChange={e => update({ restaurantName: e.target.value })}
          autoFocus
        />
      </label>
      <label className={labelCls}>
        Taux TVA (%)
        <input
          type="number" min={0} max={100} step={0.01}
          className={inputCls}
          value={data.tvaRate}
          onChange={e => update({ tvaRate: e.target.value })}
        />
        <span className="text-xs text-zinc-400">Tunisie: 7 % (restauration rapide) · 19 % (restaurant standard)</span>
      </label>
    </>
  )
}

function SpacesStep({ data, update }: { data: StepData; update: (p: Partial<StepData>) => void }) {
  return (
    <>
      <label className={labelCls}>
        Nom de votre espace
        <input
          className={inputCls}
          placeholder="ex. Salle principale, Terrasse…"
          value={data.spaceName}
          onChange={e => update({ spaceName: e.target.value })}
          autoFocus
        />
      </label>
      <label className={labelCls}>
        Nombre de tables
        <input
          type="number" min={1} max={50}
          className={inputCls}
          value={data.tableCount}
          onChange={e => update({ tableCount: e.target.value })}
        />
        <span className="text-xs text-zinc-400">Les tables seront disposées automatiquement en grille. Vous pouvez les réorganiser ensuite.</span>
      </label>
    </>
  )
}

function StaffStep({ data, update }: { data: StepData; update: (p: Partial<StepData>) => void }) {
  return (
    <>
      <label className={labelCls}>
        Nom complet
        <input
          className={inputCls}
          placeholder="ex. Ahmed Ben Ali"
          value={data.staffName}
          onChange={e => update({ staffName: e.target.value })}
          autoFocus
        />
      </label>
      <label className={labelCls}>
        Rôle
        <select
          className={inputCls}
          value={data.staffRole}
          onChange={e => update({ staffRole: e.target.value })}
        >
          <option value="Waiter">Serveur / Serveuse</option>
          <option value="Kitchen">Cuisine</option>
          <option value="Cashier">Caissier / Caissière</option>
        </select>
      </label>
      <label className={labelCls}>
        Code PIN (4 à 8 chiffres)
        <input
          type="password"
          inputMode="numeric"
          maxLength={8}
          className={inputCls}
          placeholder="ex. 1234"
          value={data.staffPin}
          onChange={e => update({ staffPin: e.target.value.replace(/\D/g, '') })}
        />
        <span className="text-xs text-zinc-400">Ce code remplace un mot de passe. Choisissez quelque chose facile à mémoriser mais pas évident.</span>
      </label>
    </>
  )
}

function MenuStep({ data, update }: { data: StepData; update: (p: Partial<StepData>) => void }) {
  return (
    <>
      <label className={labelCls}>
        Première catégorie
        <input
          className={inputCls}
          placeholder="ex. Plats, Boissons, Entrées…"
          value={data.categoryName}
          onChange={e => update({ categoryName: e.target.value })}
          autoFocus
        />
      </label>
      <label className={labelCls}>
        Premier plat ou boisson
        <input
          className={inputCls}
          placeholder="ex. Couscous Agneau"
          value={data.itemName}
          onChange={e => update({ itemName: e.target.value })}
        />
      </label>
      <label className={labelCls}>
        Prix (TND)
        <input
          type="number" min={0} step={0.001}
          className={inputCls}
          placeholder="ex. 18.000"
          value={data.itemPrice}
          onChange={e => update({ itemPrice: e.target.value })}
        />
      </label>
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stepTitle(step: Step): string {
  return {
    restaurant: 'Votre restaurant',
    spaces:     'Vos espaces & tables',
    staff:      'Votre premier employé',
    menu:       'Votre premier plat',
  }[step]
}

function isStepValid(step: Step, data: StepData): boolean {
  if (step === 'restaurant') return data.restaurantName.trim().length > 0
  if (step === 'spaces')     return data.spaceName.trim().length > 0
  if (step === 'staff')      return data.staffName.trim().length > 0 && data.staffPin.length >= 4
  if (step === 'menu')       return data.categoryName.trim().length > 0 && data.itemName.trim().length > 0
  return true
}
