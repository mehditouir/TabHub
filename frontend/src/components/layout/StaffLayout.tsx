// Full-screen layout for tablets in kiosk mode.
// useKiosk() requests fullscreen automatically — combine with iOS Guided Access
// or Android Screen Pinning for a proper hardware-level lockdown.

import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/hooks/useAuth'
import { useKiosk } from '@/lib/hooks/useKiosk'

export function StaffLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  useKiosk()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-900 text-white">
      {/* Thin top bar — visible but unobtrusive in kiosk mode */}
      <header className="flex items-center justify-between border-b border-zinc-700 px-4 py-2">
        <span className="font-bold tracking-wide text-white">TabHub — Staff</span>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <span>{user?.displayName}</span>
          <button onClick={handleLogout} className="hover:text-white">Sign out</button>
        </div>
      </header>

      {/* Page content fills remaining space */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
