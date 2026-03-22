// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface StaffLoginResponse {
  accessToken: string
  expiresAt: string
  staffId: string
  displayName: string
  role: string
}

export interface StaffUser {
  staffId: string
  displayName: string
  role: string
  tenantId: string
  tenant: string
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export type OrderStatus = 'Pending' | 'InProgress' | 'Ready' | 'Completed' | 'Cancelled'
export type OrderType = 'DineIn' | 'Takeaway'

export interface OrderItem {
  id: string
  menuItemId: string
  menuItemName: string
  unitPrice: number
  quantity: number
  notes: string | null
}

export interface Order {
  id: string
  tableId: string | null
  tableNumber: string | null
  orderType: OrderType
  sequenceNumber: string | null
  status: OrderStatus
  notes: string | null
  total: number
  createdAt: string
  updatedAt: string
  items: OrderItem[]
}

// ─── Notifications / Alerts ───────────────────────────────────────────────────

export interface DbNotification {
  id: string
  eventType: string
  orderId: string
  tableId: string | null
  isAcknowledged: boolean
  acknowledgedByStaffId: string | null
  acknowledgedByStaffName: string | null
  acknowledgedAt: string | null
  createdAt: string
  order: Order
}

export type AlertType = 'NewOrder' | 'WaiterCalled' | 'BillRequested'

export interface PendingAlert {
  id: string
  type: AlertType
  tableId: string | null
  tableNumber: string | null
  orderId: string | null
  order: Order | null
  createdAt: string
}

// ─── Spaces & Tables ─────────────────────────────────────────────────────────

export interface Space {
  id: string
  name: string
  cols: number
  rows: number
  sortOrder: number
  isActive: boolean
}

export interface Table {
  id: string
  spaceId: string
  number: string
  col: number
  row: number
  qrToken: string
  isActive: boolean
}

export interface WaiterZone {
  id: string
  spaceId: string
  colStart: number
  colEnd: number
  rowStart: number
  rowEnd: number
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export interface Session {
  id: string
  tableId: string
  tableNumber: string
  staffId: string | null
  staffName: string | null
  isOpen: boolean
  openedAt: string
  closedAt: string | null
  notes: string | null
  orderCount: number
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

export interface PublicModifierOption {
  id: string
  name: string
  priceDelta: number
}

export interface PublicModifierGroup {
  id: string
  name: string
  isRequired: boolean
  minSelections: number
  maxSelections: number
  options: PublicModifierOption[]
}

export interface PublicMenuItem {
  id: string
  name: string
  price: number
  isAvailable: boolean
  sortOrder: number
  description: string | null
  imageUrl: string | null
  modifierGroups: PublicModifierGroup[]
}

export interface PublicCategory {
  id: string
  name: string
  sortOrder: number
  items: PublicMenuItem[]
}

export interface PublicMenuResponse {
  tenant: string
  categories: PublicCategory[]
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

export interface CartItem {
  menuItemId: string
  menuItemName: string
  unitPrice: number
  quantity: number
  notes: string
}
