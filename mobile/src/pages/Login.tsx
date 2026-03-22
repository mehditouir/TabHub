// Waiter PIN login page.
// Waiter enters their restaurant's tenant slug + their 4-digit PIN.
// On success stores JWT and redirects to the floor plan tab.

import React, { useState } from 'react'
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonIcon,
  IonText,
  IonSpinner,
  useIonRouter,
} from '@ionic/react'
import { backspace } from 'ionicons/icons'
import { useWaiter } from '../contexts/WaiterContext'
import { ApiError } from '../lib/api/client'

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'] as const

export const Login: React.FC = () => {
  const { login }      = useWaiter()
  const router         = useIonRouter()
  const [tenant, setTenant] = useState('')
  const [pin, setPin]  = useState('')
  const [error, setError]  = useState('')
  const [loading, setLoading] = useState(false)

  const handleDigit = (d: number) => {
    if (pin.length < 6) setPin(prev => prev + d)
  }
  const handleDel = () => setPin(prev => prev.slice(0, -1))

  const handleSubmit = async () => {
    if (!tenant.trim()) { setError('Enter your restaurant slug'); return }
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return }
    setError('')
    setLoading(true)
    try {
      await login(tenant.trim().toLowerCase(), pin)
      router.push('/app/floor', 'root', 'replace')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>TabHub — Waiter</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ maxWidth: 360, margin: '0 auto', paddingTop: 32 }}>

          {/* Tenant slug */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
              Restaurant
            </label>
            <input
              type="text"
              placeholder="e.g. cafetunisia"
              value={tenant}
              onChange={e => setTenant(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', fontSize: 16,
                border: '1px solid #d1d5db', borderRadius: 8, boxSizing: 'border-box',
              }}
            />
          </div>

          {/* PIN display */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  style={{
                    width: 16, height: 16, borderRadius: '50%',
                    backgroundColor: pin.length > i ? '#f97316' : '#e5e7eb',
                    transition: 'background-color 0.15s',
                  }}
                />
              ))}
            </div>
            <div style={{ color: '#6b7280', fontSize: 13 }}>Enter your PIN</div>
          </div>

          {/* PIN keypad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {DIGITS.map((d, i) => {
              if (d === null) return <div key={i} />
              return (
                <IonButton
                  key={i}
                  expand="block"
                  fill="outline"
                  color={d === 'del' ? 'medium' : 'dark'}
                  onClick={() => d === 'del' ? handleDel() : handleDigit(d)}
                  style={{ height: 64, fontSize: d === 'del' ? 20 : 24, fontWeight: 600 }}
                >
                  {d === 'del' ? <IonIcon icon={backspace} /> : d}
                </IonButton>
              )
            })}
          </div>

          {/* Error */}
          {error && (
            <IonText color="danger">
              <p style={{ textAlign: 'center', marginBottom: 12 }}>{error}</p>
            </IonText>
          )}

          {/* Submit */}
          <IonButton
            expand="block"
            color="primary"
            disabled={loading || pin.length < 4 || !tenant.trim()}
            onClick={handleSubmit}
            style={{ height: 52 }}
          >
            {loading ? <IonSpinner name="crescent" /> : 'Sign In'}
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  )
}
