import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/hooks/useAuth'
import { cn } from '@/lib/utils'

const LANGUAGES = [
  { code: 'fr', label: 'FR' },
  { code: 'ar', label: 'AR' },
  { code: 'en', label: 'EN' },
]

const NAV_SLUGS = [
  { slug: 'dashboard', tk: 'nav.dashboard' },
  { slug: 'menu',      tk: 'nav.menu'      },
  { slug: 'spaces',    tk: 'nav.spaces'    },
  { slug: 'staff',     tk: 'nav.staff'     },
  { slug: 'config',    tk: 'nav.config'    },
]

export function ManagerLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { tenant } = useParams<{ tenant: string }>()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-zinc-200 bg-white">
        <div className="px-4 py-5 text-xl font-bold text-zinc-900">TabHub</div>

        <nav className="flex flex-1 flex-col gap-1 px-2">
          {NAV_SLUGS.map(({ slug, tk }) => (
            <NavLink
              key={slug}
              to={`/manager/${tenant}/${slug}`}
              className={({ isActive }) =>
                cn('rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand text-white'
                    : 'text-zinc-600 hover:bg-zinc-100')
              }
            >
              {t(tk)}
            </NavLink>
          ))}
        </nav>

        {/* Language switcher */}
        <div className="border-t border-zinc-100 px-4 py-2 flex gap-1">
          {LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => i18n.changeLanguage(code)}
              className={cn(
                'rounded px-2 py-0.5 text-xs font-medium transition-colors',
                i18n.language === code
                  ? 'bg-brand text-white'
                  : 'text-zinc-500 hover:bg-zinc-100'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="border-t border-zinc-100 px-4 py-3">
          <p className="truncate text-xs text-zinc-500">{user?.email}</p>
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            className="mt-1 text-xs text-red-500 hover:underline"
          >
            {t('common.signOut')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
