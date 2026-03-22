import { Redirect, Route } from 'react-router-dom'
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact,
} from '@ionic/react'
import { IonReactRouter } from '@ionic/react-router'
import { gridOutline, listOutline, layersOutline } from 'ionicons/icons'

import { WaiterProvider, useWaiter } from './contexts/WaiterContext'
import { NotificationBanner } from './components/NotificationBanner'
import { Login }     from './pages/Login'
import { FloorPlan } from './pages/FloorPlan'
import { Orders }    from './pages/Orders'
import { Sessions }  from './pages/Sessions'
import { PlaceOrder } from './pages/PlaceOrder'

/* Core Ionic CSS */
import '@ionic/react/css/core.css'
import '@ionic/react/css/normalize.css'
import '@ionic/react/css/structure.css'
import '@ionic/react/css/typography.css'
import '@ionic/react/css/padding.css'
import '@ionic/react/css/float-elements.css'
import '@ionic/react/css/text-alignment.css'
import '@ionic/react/css/text-transformation.css'
import '@ionic/react/css/flex-utils.css'
import '@ionic/react/css/display.css'
import '@ionic/react/css/palettes/dark.system.css'
import './theme/variables.css'

setupIonicReact()

// Inner component has access to WaiterContext
function AppRoutes() {
  const { user, alerts, dismissAlert } = useWaiter()

  return (
    <IonReactRouter>
      {/* Notification overlay (rendered above everything) */}
      {user && <NotificationBanner alerts={alerts} onDismiss={dismissAlert} />}

      <IonRouterOutlet id="main">
        {/* Public */}
        <Route exact path="/login" component={Login} />

        {/* Protected tabs */}
        <Route path="/app">
          {!user ? (
            <Redirect to="/login" />
          ) : (
            <IonTabs>
              <IonRouterOutlet>
                <Route exact path="/app/floor"            component={FloorPlan} />
                <Route exact path="/app/orders"           component={Orders} />
                <Route exact path="/app/sessions"         component={Sessions} />
                <Route       path="/app/place-order/:tableId" component={PlaceOrder} />
                <Route exact path="/app">
                  <Redirect to="/app/floor" />
                </Route>
              </IonRouterOutlet>

              <IonTabBar slot="bottom">
                <IonTabButton tab="floor" href="/app/floor">
                  <IonIcon icon={gridOutline} />
                  <IonLabel>Floor</IonLabel>
                </IonTabButton>
                <IonTabButton tab="orders" href="/app/orders">
                  <IonIcon icon={listOutline} />
                  <IonLabel>Orders</IonLabel>
                </IonTabButton>
                <IonTabButton tab="sessions" href="/app/sessions">
                  <IonIcon icon={layersOutline} />
                  <IonLabel>Sessions</IonLabel>
                </IonTabButton>
              </IonTabBar>
            </IonTabs>
          )}
        </Route>

        {/* Root redirect */}
        <Route exact path="/">
          <Redirect to={user ? '/app/floor' : '/login'} />
        </Route>
      </IonRouterOutlet>
    </IonReactRouter>
  )
}

const App: React.FC = () => (
  <IonApp>
    <WaiterProvider>
      <AppRoutes />
    </WaiterProvider>
  </IonApp>
)

export default App
