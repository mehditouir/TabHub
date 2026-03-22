// Place a new dine-in order from the tablet for a specific table.
// Shows the public menu, allows building a cart, then posts via /orders/staff (InProgress).

import React, { useEffect, useState } from 'react'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonBackButton,
  IonSpinner,
  IonText,
  IonBadge,
  IonIcon,
  IonModal,
  IonItem,
  IonLabel,
  IonList,
  useIonRouter,
} from '@ionic/react'
import { cartOutline, addCircle, removeCircle, checkmarkCircle } from 'ionicons/icons'
import { getPublicMenu } from '../lib/api/menu'
import { placeStaffOrder } from '../lib/api/orders'
import type { PublicCategory, PublicMenuItem, CartItem } from '../lib/types'
import { useParams, useLocation } from 'react-router-dom'

export const PlaceOrder: React.FC = () => {
  const { tableId }  = useParams<{ tableId: string }>()
  const location     = useLocation()
  const sessionId    = new URLSearchParams(location.search).get('sessionId') ?? undefined
  const router       = useIonRouter()

  const [categories, setCategories] = useState<PublicCategory[]>([])
  const [loading, setLoading]       = useState(true)
  const [cart, setCart]             = useState<CartItem[]>([])
  const [showCart, setShowCart]     = useState(false)
  const [placing, setPlacing]       = useState(false)
  const [success, setSuccess]       = useState(false)

  useEffect(() => {
    getPublicMenu()
      .then(res => setCategories(res.categories))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const addToCart = (item: PublicMenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id)
      if (existing) {
        return prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      }
      return [...prev, {
        menuItemId:   item.id,
        menuItemName: item.name,
        unitPrice:    item.price,
        quantity:     1,
        notes:        '',
      }]
    })
  }

  const removeFromCart = (menuItemId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === menuItemId)
      if (!existing) return prev
      if (existing.quantity <= 1) return prev.filter(c => c.menuItemId !== menuItemId)
      return prev.map(c => c.menuItemId === menuItemId ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  const cartQty = (menuItemId: string) => cart.find(c => c.menuItemId === menuItemId)?.quantity ?? 0
  const cartTotal = cart.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0)
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0)

  const submit = async () => {
    if (cart.length === 0) return
    setPlacing(true)
    try {
      await placeStaffOrder(tableId, cart, sessionId)
      setSuccess(true)
      setCart([])
      setTimeout(() => {
        setSuccess(false)
        router.goBack()
      }, 1500)
    } catch (err) {
      console.error(err)
    } finally {
      setPlacing(false)
    }
  }

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar color="primary">
            <IonButtons slot="start"><IonBackButton /></IonButtons>
            <IonTitle>Place Order</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding" style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <IonSpinner name="crescent" />
        </IonContent>
      </IonPage>
    )
  }

  if (success) {
    return (
      <IonPage>
        <IonContent style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <IonIcon icon={checkmarkCircle} style={{ fontSize: 64, color: '#22c55e' }} />
            <div style={{ marginTop: 12, fontSize: 18, fontWeight: 600 }}>Order placed!</div>
          </div>
        </IonContent>
      </IonPage>
    )
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start"><IonBackButton /></IonButtons>
          <IonTitle>Place Order</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowCart(true)} style={{ position: 'relative' }}>
              <IonIcon icon={cartOutline} style={{ color: '#fff', fontSize: 24 }} />
              {cartCount > 0 && (
                <IonBadge color="danger" style={{ position: 'absolute', top: 2, right: 2, fontSize: 10 }}>
                  {cartCount}
                </IonBadge>
              )}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {categories.length === 0 && (
          <IonText color="medium" style={{ display: 'block', textAlign: 'center', marginTop: 60 }}>
            No menu items available
          </IonText>
        )}

        {categories.map(cat => (
          <div key={cat.id}>
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#f3f4f6',
              fontWeight: 700,
              fontSize: 13,
              color: '#374151',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {cat.name}
            </div>

            {cat.items.filter(i => i.isAvailable).map(item => {
              const qty = cartQty(item.id)
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '10px 16px',
                    borderBottom: '1px solid #f3f4f6',
                    gap: 12,
                  }}
                >
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                    {item.description && (
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{item.description}</div>
                    )}
                    <div style={{ fontSize: 13, color: '#f97316', fontWeight: 600, marginTop: 2 }}>
                      {item.price.toFixed(3)} TND
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {qty > 0 && (
                      <>
                        <IonIcon
                          icon={removeCircle}
                          onClick={() => removeFromCart(item.id)}
                          style={{ fontSize: 28, color: '#ef4444', cursor: 'pointer' }}
                        />
                        <span style={{ fontWeight: 700, fontSize: 16, minWidth: 24, textAlign: 'center' }}>
                          {qty}
                        </span>
                      </>
                    )}
                    <IonIcon
                      icon={addCircle}
                      onClick={() => addToCart(item)}
                      style={{ fontSize: 28, color: '#f97316', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {/* Floating submit bar */}
        {cart.length > 0 && (
          <div style={{
            position: 'fixed', bottom: 'env(safe-area-inset-bottom, 0)',
            left: 0, right: 0, padding: '12px 16px',
            backgroundColor: '#fff', boxShadow: '0 -2px 8px rgba(0,0,0,0.12)',
            display: 'flex', gap: 12, alignItems: 'center',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{cartCount} items</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{cartTotal.toFixed(3)} TND</div>
            </div>
            <IonButton color="primary" onClick={submit} disabled={placing}>
              {placing ? <IonSpinner name="crescent" /> : 'Place Order'}
            </IonButton>
          </div>
        )}
      </IonContent>

      {/* Cart review modal */}
      <IonModal isOpen={showCart} onDidDismiss={() => setShowCart(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Cart</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setShowCart(false)}>Done</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonList>
            {cart.map(item => (
              <IonItem key={item.menuItemId}>
                <IonLabel>
                  <h3>{item.menuItemName}</h3>
                  <p>{item.unitPrice.toFixed(3)} TND × {item.quantity}</p>
                </IonLabel>
                <div slot="end" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IonIcon
                    icon={removeCircle}
                    onClick={() => removeFromCart(item.menuItemId)}
                    style={{ fontSize: 24, color: '#ef4444', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                  <IonIcon
                    icon={addCircle}
                    onClick={() => {
                      const cat = categories.flatMap(c => c.items).find(i => i.id === item.menuItemId)
                      if (cat) addToCart(cat)
                    }}
                    style={{ fontSize: 24, color: '#f97316', cursor: 'pointer' }}
                  />
                </div>
              </IonItem>
            ))}
          </IonList>
          <div className="ion-padding">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontWeight: 700 }}>
              <span>Total</span>
              <span>{cartTotal.toFixed(3)} TND</span>
            </div>
            <IonButton expand="block" color="primary" onClick={() => { setShowCart(false); submit() }} disabled={placing}>
              {placing ? <IonSpinner name="crescent" /> : 'Confirm Order'}
            </IonButton>
          </div>
        </IonContent>
      </IonModal>
    </IonPage>
  )
}
