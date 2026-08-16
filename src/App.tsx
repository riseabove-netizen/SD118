import React, { useEffect } from 'react'
import { Switch, Route, useLocation } from 'wouter'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isLoggedIn, getCrewName, isAdmin } from '@/lib/auth'
import { TextOverridesProvider, useTextOverrides } from '@/lib/textOverrides'

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
import { FireSafetyIndexPage } from '@/pages/ism/FireSafety'
import { FireSafetyPlanPage } from '@/pages/ism/FireSafetyPlan'
import { FireEquipmentPage } from '@/pages/ism/FireEquipment'
import { DrillsPage } from '@/pages/ism/Drills'
import { PerformDrillPage } from '@/pages/ism/PerformDrill'
import { SafetyEquipmentTestPage } from '@/pages/ism/SafetyEquipmentTest'
import { AnchorWatchPage } from '@/pages/ism/AnchorWatch'
import { DeckhandDutiesPage } from '@/pages/ism/DeckhandDuties'
import { DeckhandDutiesSectionPage } from '@/pages/ism/DeckhandDutiesSection'

// Inspection
import { InspectionPage } from '@/pages/inspection/Inspection'

// Inventory
import { InventoryHubPage } from '@/pages/inventory/Hub'
import { SparesListPage } from '@/pages/inventory/SparesList'
import { ConsumablesListPage } from '@/pages/inventory/ConsumablesList'
import { ToolsListPage } from '@/pages/inventory/ToolsList'
import { SuppliesListPage } from '@/pages/inventory/SuppliesList'
import { TransactionsListPage } from '@/pages/inventory/TransactionsList'
import { PurchaseListPage } from '@/pages/inventory/PurchaseList'
import { AddItemPage } from '@/pages/inventory/AddItem'
import { ItemDetailPage } from '@/pages/inventory/ItemDetail'
import { BulkAddPage } from '@/pages/inventory/BulkAdd'

// Schedule
import { ScheduleHubPage } from '@/pages/schedule/Hub'
import { TripDetailPage } from '@/pages/schedule/TripDetail'
import { EnricosSummerTripPage } from '@/pages/schedule/EnricosSummerTrip'

// Watch Duties
import { WatchHubPage } from '@/pages/watch/Hub'
import { WatchCalendarPage } from '@/pages/watch/Calendar'
import { WatchDutiesPage } from '@/pages/watch/Duties'

// Maintenance
import { MaintenanceHubPage } from '@/pages/maintenance/Hub'
import { GeneratorDetailPage } from '@/pages/maintenance/GeneratorDetail'
import { PerformMaintenancePage } from '@/pages/maintenance/Perform'
import { AirHandlersPage } from '@/pages/maintenance/AirHandlers'
import { PerformAirHandlersPage } from '@/pages/maintenance/PerformAirHandlers'
import { CalendarSystemPage } from '@/pages/maintenance/CalendarSystem'

// Operational Guides
import { GuidesListPage } from '@/pages/guides/GuidesList'
import { GuideViewPage } from '@/pages/guides/GuideView'
import { GuideEditorPage } from '@/pages/guides/GuideEditor'
import { ManualPage } from '@/pages/guides/Manual'

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
      <Route path="/ism/fire-safety">
        <AuthGuard><FireSafetyIndexPage /></AuthGuard>
      </Route>
      <Route path="/ism/fire-safety/plan">
        <AuthGuard><FireSafetyPlanPage /></AuthGuard>
      </Route>
      <Route path="/ism/fire-safety/equipment">
        <AuthGuard><FireEquipmentPage /></AuthGuard>
      </Route>
      <Route path="/ism/anchor-watch">
        <AuthGuard><AnchorWatchPage /></AuthGuard>
      </Route>
      <Route path="/ism/drills/perform">
        <AuthGuard><PerformDrillPage /></AuthGuard>
      </Route>
      <Route path="/ism/safety-equipment-test">
        <AuthGuard><SafetyEquipmentTestPage /></AuthGuard>
      </Route>
      <Route path="/ism/drills">
        <AuthGuard><DrillsPage /></AuthGuard>
      </Route>
      <Route path="/ism/deckhand-duties">
        <AuthGuard><DeckhandDutiesPage /></AuthGuard>
      </Route>
      <Route path="/ism/deckhand-duties/:sectionId">
        <AuthGuard><DeckhandDutiesSectionPage /></AuthGuard>
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
      <Route path="/inventory/tools">
        <AuthGuard><ToolsListPage /></AuthGuard>
      </Route>
      <Route path="/inventory/tools/new">
        <AuthGuard><AddItemPage tab="Tools" /></AuthGuard>
      </Route>
      <Route path="/inventory/tools/:row">
        <AuthGuard><ItemDetailPage tab="Tools" /></AuthGuard>
      </Route>
      <Route path="/inventory/supplies">
        <AuthGuard><SuppliesListPage /></AuthGuard>
      </Route>
      <Route path="/inventory/supplies/new">
        <AuthGuard><AddItemPage tab="Supplies" /></AuthGuard>
      </Route>
      <Route path="/inventory/supplies/:row">
        <AuthGuard><ItemDetailPage tab="Supplies" /></AuthGuard>
      </Route>
      <Route path="/inventory/purchase-list">
        <AuthGuard><PurchaseListPage /></AuthGuard>
      </Route>
      <Route path="/inventory/transactions">
        <AuthGuard><TransactionsListPage /></AuthGuard>
      </Route>

      {/* Schedule — PUBLIC (anyone with link can view). Editing requires login (gated in-page). */}
      <Route path="/schedule" component={ScheduleHubPage} />
      <Route path="/schedule/enricos-summer-trip" component={EnricosSummerTripPage} />
      <Route path="/schedule/:id" component={TripDetailPage} />

      {/* Watch Duties */}
      <Route path="/watch">
        <AuthGuard><WatchHubPage /></AuthGuard>
      </Route>
      <Route path="/watch/calendar">
        <AuthGuard><WatchCalendarPage /></AuthGuard>
      </Route>
      <Route path="/watch/duties">
        <AuthGuard><WatchDutiesPage /></AuthGuard>
      </Route>

      {/* Maintenance */}
      <Route path="/maintenance">
        <AuthGuard><MaintenanceHubPage /></AuthGuard>
      </Route>
      <Route path="/maintenance/perform">
        <AuthGuard><PerformMaintenancePage /></AuthGuard>
      </Route>
      <Route path="/maintenance/air-handlers">
        <AuthGuard><AirHandlersPage /></AuthGuard>
      </Route>
      <Route path="/maintenance/air-handlers/:zone">
        <AuthGuard><PerformAirHandlersPage /></AuthGuard>
      </Route>
      <Route path="/maintenance/calendar/:systemId">
        <AuthGuard><CalendarSystemPage /></AuthGuard>
      </Route>
      <Route path="/maintenance/generator/:side">
        <AuthGuard><GeneratorDetailPage /></AuthGuard>
      </Route>
      <Route path="/maintenance/system/:systemId">
        <AuthGuard><GeneratorDetailPage /></AuthGuard>
      </Route>

      {/* Operational Guides */}
      <Route path="/guides">
        <AuthGuard><GuidesListPage /></AuthGuard>
      </Route>
      <Route path="/guides/manual">
        <AuthGuard><ManualPage /></AuthGuard>
      </Route>
      <Route path="/guides/new">
        <AuthGuard><GuideEditorPage /></AuthGuard>
      </Route>
      <Route path="/guides/:id/edit">
        <AuthGuard><GuideEditorPage /></AuthGuard>
      </Route>
      <Route path="/guides/:id">
        <AuthGuard><GuideViewPage /></AuthGuard>
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

function TextEditModeOverlay() {
  const { editMode, setEditMode, saving } = useTextOverrides()
  if (!isAdmin() || !editMode) return null
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-yellow-500/60 shadow-lg">
      <span className="text-xs text-yellow-200">
        Tap any label to edit
        {saving && <span className="ml-2 opacity-70">Saving…</span>}
      </span>
      <button
        onClick={() => setEditMode(false)}
        className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
      >
        Done
      </button>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TextOverridesProvider>
        <AppRoutes />
        <TextEditModeOverlay />
      </TextOverridesProvider>
    </QueryClientProvider>
  )
}