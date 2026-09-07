import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DepsGate } from './components/DepsGate';
import { MaintenanceGate } from './components/MaintenanceGate';
import { NameGate } from './components/NameGate';
import { Sidebar } from './components/Sidebar';
import { UpdateGate } from './components/UpdateGate';
import { ControlProvider } from './lib/control';
import { AppProvider } from './lib/store';
import { BulkMediaPage } from './pages/BulkMediaPage';
import { DashboardPage } from './pages/DashboardPage';
import { DownloadsPage } from './pages/DownloadsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ShiftZeroPage } from './pages/ShiftZeroPage';
import { SingleMediaPage } from './pages/SingleMediaPage';
import { SupportPage } from './pages/SupportPage';

export default function App() {
  return (
    <AppProvider>
      <NameGate>
        <ControlProvider>
          <DepsGate>
            <MaintenanceGate>
              <HashRouter>
                <div className="app-shell">
                  <Sidebar />
                  <main className="main">
                    <Routes>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/single-image" element={<SingleMediaPage mode="image" />} />
                      <Route path="/bulk-image" element={<BulkMediaPage mode="image" />} />
                      <Route path="/single-video" element={<SingleMediaPage mode="video" />} />
                      <Route path="/bulk-video" element={<BulkMediaPage mode="video" />} />
                      <Route path="/single" element={<Navigate to="/single-image" replace />} />
                      <Route path="/bulk" element={<Navigate to="/bulk-image" replace />} />
                      <Route path="/downloads" element={<DownloadsPage />} />
                      <Route path="/notifications" element={<NotificationsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/shiftzero" element={<ShiftZeroPage />} />
                      <Route path="/support" element={<SupportPage />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </main>
                </div>
                <UpdateGate />
              </HashRouter>
            </MaintenanceGate>
          </DepsGate>
        </ControlProvider>
      </NameGate>
    </AppProvider>
  );
}
