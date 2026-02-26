import { useCallback, useEffect, useState } from 'react'
import { getApiErrorMessage } from '../utils/apiError'

export default function useApi(fn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const run = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fn()
      setData(res?.data?.data ?? res?.data ?? null)
      return res
    } catch (e) {
      setError(getApiErrorMessage(e))
      throw e
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => {
    run().catch(() => {})
  }, [run])

  return { data, loading, error, run, setData }
}
