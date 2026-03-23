// All routes in one place — easy to see the whole navigation structure at a glance.
// Route groups mirror the three surfaces: public (customer), staff, manager.

import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ManagerLayout } from '@/components/layout/ManagerLayout'
import { StaffLayout }   from '@/components/layout/StaffLayout'
import { Login }         from '@/pages/Login'
import { CustomerMenu }      from '@/pages/CustomerMenu'
import { TakeawayDisplay }   from '@/pages/TakeawayDisplay'
import { KitchenApp }        from '@/pages/KitchenApp'
import { CashierApp }        from '@/pages/CashierApp'
import { WaiterApp }         from '@/pages/WaiterApp'
import { StaffOrders }    from '@/pages/staff/Orders'
import { Dashboard }      from '@/pages/manager/Dashboard'
import { Menu }           from '@/pages/manager/Menu'
import { Spaces }         from '@/pages/manager/Spaces'
import { Staff }          from '@/pages/manager/Staff'
import { Config }         from '@/pages/manager/Config'
import { AdminLogin }     from '@/pages/admin/AdminLogin'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { getAdminToken }  from '@/lib/api/admin'

// ── Auth guard ──────────────────────────────────────────────────────────────
// Simple wrapper: if no token in localStorage, redirect to /login.
// Proper server-side protection is handled by the backend JWT + tenant checks.

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('tabhub_token')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function RequireAdminAuth({ children }: { children: React.ReactNode }) {
  return getAdminToken() ? <>{children}</> : <Navigate to="/admin/login" replace />
}

// ── Router ──────────────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  // Public: customer scans QR → /menu/:tenant?table=<qrToken>
  {
    path: '/menu/:tenant',
    element: <CustomerMenu />,
  },

  // Public: takeaway display screen → /takeaway/:tenant
  {
    path: '/takeaway/:tenant',
    element: <TakeawayDisplay />,
  },

  // Staff: kitchen display → /kitchen/:tenant
  {
    path: '/kitchen/:tenant',
    element: <KitchenApp />,
  },

  // Staff: cashier kiosk → /cashier/:tenant
  {
    path: '/cashier/:tenant',
    element: <CashierApp />,
  },

  // Staff: waiter tablet app → /waiter/:tenant
  {
    path: '/waiter/:tenant',
    element: <WaiterApp />,
  },

  // Auth
  {
    path: '/login',
    element: <Login />,
  },

  // Staff — full-screen kiosk layout
  {
    path: '/staff/:tenant',
    element: <RequireAuth><StaffLayout /></RequireAuth>,
    children: [
      { index: true,      element: <Navigate to="orders" replace /> },
      { path: 'orders',   element: <StaffOrders /> },
    ],
  },

  // Manager — sidebar layout
  {
    path: '/manager/:tenant',
    element: <RequireAuth><ManagerLayout /></RequireAuth>,
    children: [
      { index: true,       element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'menu',      element: <Menu /> },
      { path: 'spaces',    element: <Spaces /> },
      { path: 'staff',     element: <Staff /> },
      { path: 'config',    element: <Config /> },
    ],
  },

  // Admin
  {
    path: '/admin/login',
    element: <AdminLogin />,
  },
  {
    path: '/admin',
    element: <RequireAdminAuth><AdminDashboard /></RequireAdminAuth>,
  },

  // Catch-all → login
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
])

