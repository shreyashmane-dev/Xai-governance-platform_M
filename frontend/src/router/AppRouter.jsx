import { Navigate, Route, Routes } from 'react-router-dom'
import LandingPage from '../pages/LandingPage'
import AuthPage from '../pages/AuthPage'
import DashboardPage from '../pages/DashboardPage'
import ModelsPage from '../pages/ModelsPage'
import ExplainabilityPage from '../pages/ExplainabilityPage'
import GovernancePage from '../pages/GovernancePage'
import DriftPage from '../pages/DriftPage'
import ReportsPage from '../pages/ReportsPage'
import AssistantPage from '../pages/AssistantPage'
import SettingsPage from '../pages/SettingsPage'
import AboutPage from '../pages/AboutPage'
import DocsPage from '../pages/DocsPage'
import AuditLogsPage from '../pages/AuditLogsPage'
import AppLayout from '../layouts/AppLayout'
import useRequireAuth from '../hooks/useRequireAuth'

function Protected({ children }) {
  const { isAuthenticated, loading } = useRequireAuth()
  if (loading) return <div className="p-6 text-slate-400">Loading...</div>
  if (!isAuthenticated) return <Navigate to="/auth" replace />
  return <AppLayout>{children}</AppLayout>
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/docs/:docId?" element={<DocsPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/models" element={<Protected><ModelsPage /></Protected>} />
      <Route path="/explainability" element={<Protected><ExplainabilityPage /></Protected>} />
      <Route path="/governance" element={<Protected><GovernancePage /></Protected>} />
      <Route path="/drift" element={<Protected><DriftPage /></Protected>} />
      <Route path="/reports" element={<Protected><ReportsPage /></Protected>} />
      <Route path="/assistant" element={<Protected><AssistantPage /></Protected>} />
      <Route path="/audit-logs" element={<Protected><AuditLogsPage /></Protected>} />
      <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
