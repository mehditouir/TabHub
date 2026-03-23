// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string
  manager: { id: string; email: string; displayName: string }
}

export interface StaffLoginResponse {
  accessToken: string
  expiresAt:   string
  staffId:     string
  displayName: string
  role:        string
}

export interface StaffUser {
  staffId:     string
  displayName: string
  role:        string
  tenant:      string
}

export interface AuthUser {
  email: string
  displayName: string
  role: string        // 'owner' | 'admin'
  tenantId: string
  tenant: string      // slug, stored in X-Tenant header
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu (public)
// ─────────────────────────────────────────────────────────────────────────────

export interface MenuItemTranslation { language: string; name: string; description: string | null }

export interface PublicModifierOption {
  id:         string
  name:       string
  priceDelta: number
}

export interface PublicModifierGroup {
  id:            string
  name:          string
  isRequired:    boolean
  minSelections: number
  maxSelections: number
  options:       PublicModifierOption[]
}

export interface PublicMenuItem {
  id:             string
  name:           string
  price:          number
  isAvailable:    boolean
  sortOrder:      number
  description:    string | null
  imageUrl:       string | null
  translations:   MenuItemTranslation[]
  modifierGroups: PublicModifierGroup[]
}

export interface CategoryTranslation { language: string; name: string }

export interface PublicCategory {
  id:           string
  name:         string
  sortOrder:    number
  translations: CategoryTranslation[]
  items:        PublicMenuItem[]
}

export interface PublicMenuResponse {
  tenant:     string
  categories: PublicCategory[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────────────────────

export type OrderStatus = 'Pending' | 'InProgress' | 'Ready' | 'Completed' | 'Cancelled'
export type OrderType   = 'DineIn' | 'Takeaway'

export interface OrderItem {
  id:           string
  menuItemId:   string
  menuItemName: string
  unitPrice:    number
  quantity:     number
  notes:        string | null
}

export interface Order {
  id:             string
  tableId:        string | null
  tableNumber:    string | null
  orderType:      OrderType
  sequenceNumber: string | null
  status:         OrderStatus
  notes:          string | null
  total:          number
  createdAt:      string
  updatedAt:      string
  items:          OrderItem[]
}

export interface CreateOrderItem { menuItemId: string; quantity: number; notes?: string }
export interface CreateOrderRequest { qrToken: string; items: CreateOrderItem[]; notes?: string }

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

export interface Notification {
  id:                    string
  eventType:             string
  orderId:               string
  tableId:               string | null
  isAcknowledged:        boolean
  acknowledgedByStaffId: string | null
  acknowledgedByStaffName: string | null
  acknowledgedAt:        string | null
  createdAt:             string
  order:                 Order
}

// ─────────────────────────────────────────────────────────────────────────────
// Reports
// ─────────────────────────────────────────────────────────────────────────────

export interface RevenueDayDto    { date: string; revenue: number; orderCount: number }
export interface RevenueReport    { from: string; to: string; totalRevenue: number; totalOrders: number; byDay: RevenueDayDto[] }
export interface TopItem          { menuItemId: string; name: string; totalQuantity: number; totalRevenue: number }
export interface OrderSummary     { totalOrders: number; pending: number; inProgress: number; ready: number; completed: number; cancelled: number; avgCompletionMinutes: number | null }
export interface BusyHour         { hour: number; orderCount: number }

// ─────────────────────────────────────────────────────────────────────────────
// Management (staff, categories, spaces, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export interface StaffMember { id: string; displayName: string; role: string; isActive: boolean }
export interface WaiterZone  { id: string; spaceId: string; colStart: number; colEnd: number; rowStart: number; rowEnd: number }
export interface Category    { id: string; name: string; sortOrder: number; isActive: boolean; translations: CategoryTranslation[] }
export interface MenuItem    { id: string; categoryId: string; name: string; price: number; isAvailable: boolean; sortOrder: number; description: string | null; imageUrl: string | null }
export interface Space       { id: string; name: string; cols: number; rows: number; sortOrder: number; isActive: boolean }
export interface Table       { id: string; spaceId: string; number: string; col: number; row: number; qrToken: string; isActive: boolean }
export interface TableResolveResponse { tableId: string; tableNumber: string }

// ─────────────────────────────────────────────────────────────────────────────
// Customer shared cart sync (SignalR)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────────────────────

export interface Session {
  id:          string
  tableId:     string
  tableNumber: string | null
  staffId:     string | null
  staffName:   string | null
  isOpen:      boolean
  openedAt:    string
  closedAt:    string | null
  notes:       string | null
  orderCount:  number
}

export type AlertType = 'NewOrder' | 'WaiterCalled' | 'BillRequested'

export interface PendingAlert {
  id:          string
  type:        AlertType
  tableId:     string | null
  tableNumber: string | null
  orderId:     string | null
  order:       Order | null
  createdAt:   string
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer shared cart sync (SignalR)
// ─────────────────────────────────────────────────────────────────────────────

export interface CartSyncItem {
  itemId:            string
  quantity:          number
  selectedModifiers: Record<string, string[]>
}
