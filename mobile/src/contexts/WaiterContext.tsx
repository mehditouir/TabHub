import React, { createContext, useContext } from 'react'
import { useAuth } from '../lib/hooks/useAuth'
import { useWaiterHub } from '../lib/hooks/useWaiterHub'
import type { StaffUser, Order, PendingAlert } from '../lib/types'

interface WaiterContextValue {
  user:         StaffUser | null
  login:        (tenant: string, pin: string) => Promise<void>
  logout:       () => void
  orders:       Order[]
  setOrders:    React.Dispatch<React.SetStateAction<Order[]>>
  alerts:       PendingAlert[]
  dismissAlert: (id: string) => void
  connected:    boolean
  refresh:      () => Promise<void>
}

const WaiterContext = createContext<WaiterContextValue | null>(null)

export function WaiterProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const hub  = useWaiterHub(!!auth.user)

  return (
    <WaiterContext.Provider value={{
      user:         auth.user,
      login:        auth.login,
      logout:       auth.logout,
      orders:       hub.orders,
      setOrders:    hub.setOrders,
      alerts:       hub.alerts,
      dismissAlert: hub.dismissAlert,
      connected:    hub.connected,
      refresh:      hub.refresh,
    }}>
      {children}
    </WaiterContext.Provider>
  )
}

export function useWaiter() {
  const ctx = useContext(WaiterContext)
  if (!ctx) throw new Error('useWaiter must be used inside WaiterProvider')
  return ctx
}
