import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth, RequireOnboarding, RequireAdmin } from './components/auth/RouteGuards'
import { AppShell } from './components/shell/AppShell'
import { isSupabaseConfigured } from './lib/supabase'
import { LoginPage } from './pages/auth/LoginPage'
import { SetupPage } from './pages/auth/SetupPage'
import { ReviewPage } from './pages/admin/ReviewPage'
import { AdminShell } from './pages/admin/AdminShell'
import { CatalogPage } from './pages/admin/CatalogPage'
import { GeneratePage } from './pages/admin/GeneratePage'
import { ImportPage } from './pages/admin/ImportPage'
import { CommsPage } from './pages/cmd/CommsPage'
import { LeaderboardPage } from './pages/cmd/LeaderboardPage'
import { MissionsPage } from './pages/cmd/MissionsPage'
import { VaultPage } from './pages/cmd/VaultPage'
import { OpsHubPage } from './pages/ops/OpsHubPage'
import { CasualLobbyPage } from './pages/ops/CasualLobbyPage'
import { CasualArenaPage } from './pages/ops/CasualArenaPage'
import { TimedConfigPage } from './pages/ops/TimedConfigPage'
import { TimedExamPage } from './pages/ops/TimedExamPage'
import { TimedAutopsyPage } from './pages/ops/TimedAutopsyPage'
import { BinderPage } from './pages/ops/BinderPage'
import { ProfilePage } from './pages/profile/ProfilePage'

function shellRoutes() {
  return (
    <>
      <Route path="/" element={<Navigate to="/cmd/missions" replace />} />
      <Route path="/cmd/missions" element={<MissionsPage />} />
      <Route path="/cmd/vault" element={<VaultPage />} />
      <Route path="/cmd/comms" element={<CommsPage />} />
      <Route path="/cmd/leaderboard" element={<LeaderboardPage />} />
      <Route path="/ops" element={<OpsHubPage />} />
      <Route path="/ops/casual" element={<CasualLobbyPage />} />
      <Route path="/ops/casual/arena" element={<CasualArenaPage />} />
      <Route path="/ops/timed" element={<TimedConfigPage />} />
      <Route path="/ops/timed/exam" element={<TimedExamPage />} />
      <Route path="/ops/timed/autopsy" element={<TimedAutopsyPage />} />
      <Route path="/ops/binder" element={<BinderPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route element={<RequireAdmin />}>
        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<Navigate to="/admin/catalog" replace />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="generate" element={<GeneratePage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="import" element={<ImportPage />} />
        </Route>
      </Route>
    </>
  )
}
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/signup"
          element={<Navigate to="/login?mode=signup" replace />}
        />

        {isSupabaseConfigured ? (
          <>
            <Route element={<RequireAuth />}>
              <Route path="/setup" element={<SetupPage />} />
              <Route element={<RequireOnboarding />}>
                <Route element={<AppShell />}>{shellRoutes()}</Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            <Route element={<AppShell />}>{shellRoutes()}</Route>
            <Route path="*" element={<Navigate to="/cmd/missions" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  )
}

