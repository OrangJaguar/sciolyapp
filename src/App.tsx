import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/shell/AppShell'
import { CommsPage } from './pages/cmd/CommsPage'
import { LeaderboardPage } from './pages/cmd/LeaderboardPage'
import { MissionsPage } from './pages/cmd/MissionsPage'
import { VaultPage } from './pages/cmd/VaultPage'
import { OpsHubPage } from './pages/ops/OpsHubPage'
import {
  AdminPage,
  BinderStubPage,
  CasualStubPage,
  ProfilePage,
  TimedStubPage,
} from './pages/placeholders/StubPages'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/cmd/missions" replace />} />
          <Route path="/cmd/missions" element={<MissionsPage />} />
          <Route path="/cmd/vault" element={<VaultPage />} />
          <Route path="/cmd/comms" element={<CommsPage />} />
          <Route path="/cmd/leaderboard" element={<LeaderboardPage />} />
          <Route path="/ops" element={<OpsHubPage />} />
          <Route path="/ops/casual" element={<CasualStubPage />} />
          <Route path="/ops/timed" element={<TimedStubPage />} />
          <Route path="/ops/binder" element={<BinderStubPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/cmd/missions" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
