import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom'
import { Shell } from './layout/Shell'
import { DashboardPage } from './pages/DashboardPage'
import { JobsPage } from './pages/JobsPage'
import { VideoPage } from './pages/VideoPage'
import { ChannelPage } from './pages/ChannelPage'
import { SocialPage } from './pages/SocialPage'
import { LibraryPage } from './pages/LibraryPage'
import { ReportsPage } from './pages/ReportsPage'
import { DependenciesPage } from './pages/DependenciesPage'
import { SettingsPage } from './pages/SettingsPage'
import { AboutPage } from './pages/AboutPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ControlProvider } from './lib/control'
import { MaintenanceGate } from './components/MaintenanceGate'
import { UpdateGate } from './components/UpdateGate'

const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'jobs', element: <JobsPage /> },
      { path: 'video', element: <VideoPage /> },
      { path: 'channel', element: <ChannelPage /> },
      { path: 'facebook', element: <Navigate to="/social" replace /> },
      { path: 'tiktok', element: <Navigate to="/social" replace /> },
      { path: 'instagram', element: <Navigate to="/social" replace /> },
      { path: 'social', element: <SocialPage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'dependencies', element: <DependenciesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'about', element: <AboutPage /> },
    ],
  },
])

export default function App() {
  return (
    <ControlProvider>
      <MaintenanceGate>
        <UpdateGate />
        <RouterProvider router={router} />
      </MaintenanceGate>
    </ControlProvider>
  )
}
