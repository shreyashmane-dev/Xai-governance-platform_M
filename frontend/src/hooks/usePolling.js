import { useEffect } from 'react'

export default function usePolling(fn, intervalMs = 30000, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => {
      fn().catch(() => {})
    }, intervalMs)
    return () => clearInterval(id)
  }, [enabled, fn, intervalMs])
}
