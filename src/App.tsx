import React, { useEffect } from 'react'
import { Switch, Route, useLocation } from 'wouter'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isLoggedIn, getCrewName } from '@/lib/auth'

// Pages
import { LoginPage } from '@/pages/Login'
import { SetNamePage } from '@/pages/SetName'
import { MenuPage } from '@/pages/Menu'
import { SettingsPage } from '@/pages/Settings'

// Running Log
import { UploadPage } from '@/pages/runlog/Upload'
import { ReviewPage } from '@/pages/runlog/Review'
import { SuccessPage } from '@/pages/runlog/Success'

// ISM
import { IsmIndexPage } from '@/pages/ism/Index'
import { IsmListPage } from '@/pages/ism/List'
import { IsmFormPage } from '@/pages/ism/Form'
import { IsmPreviewPage } from '@/pages/ism/Preview'

// Inspection
import { InspectionPage } from '@/pages/inspection/Inspection'

// Inventory
import { InventoryHubPage } from '@/pages/inventory/Hub'
import { SparesListPage } from '@/pages/inventory/SparesList'
import { ConsumablesListPage } from '@/pages/inventory/ConsumablesList'
import { TransactionsListPage } from '@/pages/inventory/TransactionsList'
import { AddItemPage } from '@/pages/inventory/AddItem'
import { ItemDetailPage } from '@/pages/inventory/ItemDetail'
import { BulkAddPage } from '@/pages/inventory/BulkAdd'

// Schedule
import { ScheduleHubPage } from '@/pages/schedule/Hub'
import { TripDetailPage } from '@/pages/schedule/TripDetail'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
})

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation()

  useEffect(() => {
    if (!isLoggedIn()) {
      if (location !== '/') {
        setLocation('/')
      }
      return
    }
    if (!getCrewName() && location !== '/settings/name') {
      setLocation('/settings/name')
      return
    }
  }, [location, setLocation])

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={LoginPageGuard} />

      {/* Name setup */}
      <Route path="/settings/name" component={SetNamePage} />

      {/* Protected */}
      <Route path="/menu">
        <AuthGuard><MenuPage /></AuthGuard>
      </Route>
      <Route path="/settings">
        <AuthGuard><SettingsPage /></AuthGuard>
      </Route>

      {/* Running Log */}
      <Route path="/runlog/upload">
        <AuthGuard><UploadPage /></AuthGuard>
      </Route>
      <Route path="/runlog/review">
        <AuthGuard><ReviewPage /></AuthGuard>
      </Route>
      <Route path="/runlog/success">
        <AuthGuard><SuccessPage /></AuthGuard>
      </Route>

      {/* ISM */}
      <Route path="/ism">
        <AuthGuard><IsmIndexPage /></AuthGuard>
      </Route>
      <Route path="/ism/operating">
        <AuthGuard><IsmListPage /></AuthGuard>
      </Route>
      <Route path="/ism/emergency">
        <AuthGuard><IsmListPage /></AuthGuard>
      </Route>
      <Route path="/ism/form/:formId">
        <AuthGuard><IsmFormPage /></AuthGuard>
      </Route>
      <Route path="/ism/preview/:id">
        <AuthGuard><IsmPreviewPage /></AuthGuard>
      </Route>

      {/* Engine Room Inspection */}
      <Route path="/inspection">
        <AuthGuard><InspectionPage /></AuthGuard>
      </Route>

      {/* Inventory */}
      <Route path="/inventory">
        <AuthGuard><InventoryHubPage /></AuthGuard>
      </Route>
      <Route path="/inventory/bulk-add">
        <AuthGuard><BulkAddPage /></AuthGuard>
      </Route>
      <Route path="/inventory/spares">
        <AuthGuard><SparesListPage /></AuthGuard>
      </Route>
      <Route path="/inventory/spares/new">
        <AuthGuard><AddItemPage tab="Spares" /></AuthGuard>
      </Route>
      <Route path="/inventory/spares/:row">
        <AuthGuard><ItemDetailPage tab="Spares" /></AuthGuard>
      </Route>
      <Route path="/inventory/consumables">
        <AuthGuard><ConsumablesListPage /></AuthGuard>
      </Route>
      <Route path="/inventory/consumables/new">
        <AuthGuard><AddItemPage tab="Consumables" /></AuthGuard>
      </Route>
      <Route path="/inventory/consumables/:row">
        <AuthGuard><ItemDetailPage tab="Consumables" /></AuthGuard>
      </Route>
      <Route path="/inventory/transactions">
        <AuthGuard><TransactionsListPage /></AuthGuard>
      </Route>

      {/* Schedule */}
      <Route path="/schedule">
        <AuthGuard><ScheduleHubPage /></AuthGuard>
      </Route>
      <Route path="/schedule/:id">
        <AuthGuard><TripDetailPage /></AuthGuard>
      </Route>

      {/* Fallback */}
      <Route>
        <FallbackRedirect />
      </Route>
    </Switch>
  )
}

function LoginPageGuard() {
  const [, setLocation] = useLocation()

  useEffect(() => {
    if (isLoggedIn()) {
      if (!getCrewName()) {
        setLocation('/settings/name')
      } else {
        setLocation('/menu')
      }
    }
  }, [setLocation])

  return <LoginPage />
}

function FallbackRedirect() {
  const [, setLocation] = useLocation()
  useEffect(() => {
    setLocation(isLoggedIn() ? '/menu' : '/')
  }, [setLocation])
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  )
}