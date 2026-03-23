import type { Order, PublicMenuResponse, OrderSummary, TopItem, RevenueReport } from '@/lib/types'

export const FIXTURES = {
  order: {
    id:          'order-1',
    tableId:     'table-1',
    tableNumber: '5',
    status:      'Pending',
    notes:       null,
    total:       12.500,
    createdAt:   '2026-01-15T10:30:00Z',
    updatedAt:   '2026-01-15T10:30:00Z',
    items: [
      {
        id:           'item-1',
        menuItemId:   'menu-item-1',
        menuItemName: 'Cappuccino',
        unitPrice:    4.500,
        quantity:     2,
        notes:        null,
      },
      {
        id:           'item-2',
        menuItemId:   'menu-item-2',
        menuItemName: 'Croissant',
        unitPrice:    3.500,
        quantity:     1,
        notes:        'extra butter',
      },
    ],
  } satisfies Order,

  orderInProgress: {
    id:          'order-2',
    tableId:     'table-2',
    tableNumber: '3',
    status:      'InProgress',
    notes:       null,
    total:       4.500,
    createdAt:   '2026-01-15T11:00:00Z',
    updatedAt:   '2026-01-15T11:05:00Z',
    items: [
      {
        id:           'item-3',
        menuItemId:   'menu-item-1',
        menuItemName: 'Cappuccino',
        unitPrice:    4.500,
        quantity:     1,
        notes:        null,
      },
    ],
  } satisfies Order,

  orderCompleted: {
    id:          'order-3',
    tableId:     'table-1',
    tableNumber: '5',
    status:      'Completed',
    notes:       null,
    total:       4.500,
    createdAt:   '2026-01-15T09:00:00Z',
    updatedAt:   '2026-01-15T09:20:00Z',
    items: [
      {
        id:           'item-4',
        menuItemId:   'menu-item-1',
        menuItemName: 'Cappuccino',
        unitPrice:    4.500,
        quantity:     1,
        notes:        null,
      },
    ],
  } satisfies Order,

  menu: {
    tenant: 'cafejasmine',
    categories: [
      {
        id:       'cat-1',
        name:     'Hot Drinks',
        sortOrder: 1,
        translations: [],
        items: [
          {
            id:             'menu-item-1',
            name:           'Cappuccino',
            price:          4.500,
            isAvailable:    true,
            sortOrder:      1,
            description:    'Espresso with steamed milk',
            imageUrl:       null,
            translations:   [],
            modifierGroups: [],
          },
        ],
      },
      {
        id:       'cat-2',
        name:     'Pastries',
        sortOrder: 2,
        translations: [],
        items: [
          {
            id:             'menu-item-2',
            name:           'Croissant',
            price:          3.500,
            isAvailable:    true,
            sortOrder:      1,
            description:    null,
            imageUrl:       null,
            translations:   [],
            modifierGroups: [],
          },
        ],
      },
    ],
  } satisfies PublicMenuResponse,

  orderSummary: {
    totalOrders: 42,
    pending:     5,
    inProgress:  3,
    ready:       2,
    completed:   30,
    cancelled:   2,
    avgCompletionMinutes: 18,
  } satisfies OrderSummary,

  topItems: [
    { menuItemId: 'menu-item-1', name: 'Cappuccino', totalQuantity: 80, totalRevenue: 360.000 },
    { menuItemId: 'menu-item-2', name: 'Croissant',  totalQuantity: 45, totalRevenue: 157.500 },
  ] satisfies TopItem[],

  revenueReport: {
    from:         '2026-01-01T00:00:00Z',
    to:           '2026-01-31T23:59:59Z',
    totalRevenue: 1250.500,
    totalOrders:  42,
    byDay: [
      { date: '2026-01-01', revenue: 45.000, orderCount: 3 },
      { date: '2026-01-02', revenue: 60.500, orderCount: 4 },
    ],
  } satisfies RevenueReport,
}
