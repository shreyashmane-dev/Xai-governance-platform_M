import { useMemo, useState } from 'react'
import Joyride from 'react-joyride'
import { useLocation } from 'react-router-dom'
import Sidebar from '../components/common/Sidebar'
import Topbar from '../components/common/Topbar'
import ToastStack from '../components/feedback/ToastStack'
import useApi from '../hooks/useApi'
import usePolling from '../hooks/usePolling'
import { tourSteps } from '../components/tour/tourSteps'
import { systemService } from '../services'

function getStatusData(payload) {
  if (!payload) return { ok: false, uptimeSeconds: null }
  return {
    ok: Boolean(payload.ok),
    uptimeSeconds: payload.uptime_seconds ?? null,
  }
}

export default function AppLayout({ children }) {
  const location = useLocation()
  const [runTour, setRunTour] = useState(localStorage.getItem('xai_tour_done') !== '1')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { data, run } = useApi(() => systemService.status(), [])

  usePolling(run, 20000, true)
  const status = useMemo(() => getStatusData(data), [data])
  const availableTourSteps = useMemo(() => {
    if (typeof document === 'undefined') return tourSteps
    return tourSteps.filter((step) => step.target === 'body' || Boolean(document.querySelector(step.target)))
  }, [location.pathname, children])

  return (
    <div className="page-shell">
      <Joyride
        steps={availableTourSteps}
        run={runTour}
        continuous
        showSkipButton
        styles={{ options: { backgroundColor: '#0f172a', textColor: '#e5e7eb', primaryColor: '#1e3a8a' } }}
        callback={(state) => {
          if (state.status === 'finished' || state.status === 'skipped') {
            localStorage.setItem('xai_tour_done', '1')
            setRunTour(false)
          }
        }}
      />

      <ToastStack />
      <div className="flex min-h-screen">
        <Sidebar
          status={status}
          mobileOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          onRestartTour={() => {
            setRunTour(true)
            setMobileNavOpen(false)
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar status={status} onMenuClick={() => setMobileNavOpen(true)} />
          <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-10">{children}</main>
        </div>
      </div>
    </div>
  )
}
