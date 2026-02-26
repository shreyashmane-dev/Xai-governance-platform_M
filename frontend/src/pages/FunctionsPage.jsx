import { useEffect, useMemo, useState } from 'react'
import { EmptyState, ErrorState, Loader } from '../components/feedback/States'
import { systemService } from '../services'
import api from '../services/apiClient'
import { getApiErrorMessage } from '../utils/apiError'

function normalizePath(path) {
  const clean = (path || '').trim()
  if (!clean) return ''
  const [pathname] = clean.split('?')
  return pathname.startsWith('/api') ? pathname : `/api${pathname.startsWith('/') ? '' : '/'}${pathname}`
}

function parseDocumentedFunctions(markdown) {
  const matches = [...markdown.matchAll(/`(GET|POST|PUT|PATCH|DELETE)\s+([^`]+)`/g)]
  return matches.map((entry) => {
    const method = entry[1]
    const rawPath = entry[2]
    const path = normalizePath(rawPath)
    return {
      id: `DOC:${method}:${path}`,
      method,
      path,
      rawPath,
      group: 'documentation',
      name: 'documented_endpoint',
      source: 'docs',
    }
  })
}

export default function FunctionsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [functions, setFunctions] = useState([])
  const [documentedFunctions, setDocumentedFunctions] = useState([])
  const [docsError, setDocsError] = useState('')
  const [selfTest, setSelfTest] = useState(null)
  const [testerMethod, setTesterMethod] = useState('GET')
  const [testerPath, setTesterPath] = useState('/api/system/status')
  const [testerQuery, setTesterQuery] = useState('')
  const [testerBody, setTesterBody] = useState('{\n  "session_id": "default",\n  "message": "Health check from Functions Center",\n  "context": {\n    "metrics": {},\n    "shapSummary": {},\n    "biasSummary": {},\n    "driftSummary": {},\n    "trustScore": 75\n  }\n}')
  const [testerLoading, setTesterLoading] = useState(false)
  const [testerResult, setTesterResult] = useState(null)

  async function refresh() {
    setLoading(true)
    setError('')
    setDocsError('')
    try {
      const [functionsRes, selfTestRes, docsRes] = await Promise.all([
        systemService.functions(),
        systemService.selfTest(),
        fetch('/docs/API_DOCUMENTATION.md'),
      ])
      setFunctions(functionsRes?.data?.data?.functions || [])
      setSelfTest(selfTestRes?.data?.data || null)
      if (docsRes.ok) {
        const markdown = await docsRes.text()
        setDocumentedFunctions(parseDocumentedFunctions(markdown))
      } else {
        setDocumentedFunctions([])
        setDocsError(`Could not load API docs (${docsRes.status}).`)
      }
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const fn of functions) {
      const key = fn.group || 'general'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(fn)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [functions])
  const liveKeys = useMemo(() => new Set(functions.map((fn) => `${fn.method}:${normalizePath(fn.path)}`)), [functions])
  const docsKeys = useMemo(() => new Set(documentedFunctions.map((fn) => `${fn.method}:${normalizePath(fn.path)}`)), [documentedFunctions])
  const docsMissingInLive = useMemo(
    () => documentedFunctions.filter((fn) => !liveKeys.has(`${fn.method}:${normalizePath(fn.path)}`)),
    [documentedFunctions, liveKeys]
  )
  const liveMissingInDocs = useMemo(
    () => functions.filter((fn) => !docsKeys.has(`${fn.method}:${normalizePath(fn.path)}`)),
    [functions, docsKeys]
  )
  const coverageMatrix = useMemo(() => {
    const merged = new Map()
    for (const fn of documentedFunctions) {
      const key = `${fn.method}:${normalizePath(fn.path)}`
      merged.set(key, { ...fn, source: 'docs' })
    }
    for (const fn of functions) {
      const key = `${fn.method}:${normalizePath(fn.path)}`
      if (merged.has(key)) {
        merged.set(key, { ...fn, source: 'both' })
      } else {
        merged.set(key, { ...fn, source: 'live' })
      }
    }
    return Array.from(merged.values()).sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`))
  }, [documentedFunctions, functions])

  function setTesterFromFunction(fn) {
    setTesterMethod(fn.method || 'GET')
    setTesterPath(normalizePath(fn.path || ''))
    setTesterQuery('')
  }

  async function runTester() {
    setTesterLoading(true)
    setTesterResult(null)
    try {
      const method = testerMethod.toUpperCase()
      const normalizedPath = normalizePath(testerPath)
      const url = normalizedPath.startsWith('/api') ? normalizedPath.slice(4) : normalizedPath
      const params = new URLSearchParams(testerQuery || '')
      const config = { method, url: url || '/', params }
      if (['POST', 'PUT', 'PATCH'].includes(method) && testerBody.trim()) {
        try {
          config.data = JSON.parse(testerBody)
        } catch {
          throw new Error('Request body must be valid JSON.')
        }
      }
      const response = await api.request(config)
      setTesterResult({
        ok: true,
        status: response.status,
        data: response.data,
      })
    } catch (err) {
      setTesterResult({
        ok: false,
        status: err?.response?.status || 0,
        data: err?.response?.data || { detail: getApiErrorMessage(err) },
      })
    } finally {
      setTesterLoading(false)
    }
  }

  if (loading) return <Loader text="Loading backend functions..." />
  if (error) return <ErrorState message={error} />

  return (
    <div className="space-y-4" data-tour="functions">
      <div className="card flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Functions Center</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Live backend function registry and runtime self-test.
          </p>
        </div>
        <button className="btn-primary" onClick={refresh}>Refresh</button>
      </div>

      <div className="card">
        <h4 className="mb-2 font-semibold">Backend Self-Test</h4>
        {!selfTest ? (
          <EmptyState title="No self-test data" description="Click refresh to run backend checks." />
        ) : (
          <div className="space-y-2">
            <div className="text-sm">
              Overall:
              <span className={`ml-2 status-badge ${selfTest.ok ? 'status-ok' : 'status-warn'}`}>
                {selfTest.ok ? 'PASS' : 'ISSUES'}
              </span>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: 'var(--border-muted)' }}>
                    <th className="px-2 py-1">Check</th>
                    <th className="px-2 py-1">Status</th>
                    <th className="px-2 py-1">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {(selfTest.checks || []).map((check) => (
                    <tr key={check.name} className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                      <td className="px-2 py-1">{check.name}</td>
                      <td className="px-2 py-1">{check.ok ? 'OK' : 'FAIL'}</td>
                      <td className="px-2 py-1">{check.detail || check.value || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h4 className="mb-2 font-semibold">Available Backend Functions ({functions.length})</h4>
        {!functions.length ? (
          <EmptyState title="No functions found" description="Backend did not return route functions." />
        ) : (
          <div className="space-y-4">
            {grouped.map(([groupName, items]) => (
              <div key={groupName}>
                <h5 className="mb-1 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>{groupName}</h5>
                <div className="overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b text-left" style={{ borderColor: 'var(--border-muted)' }}>
                        <th className="px-2 py-1">Method</th>
                        <th className="px-2 py-1">Path</th>
                        <th className="px-2 py-1">Function</th>
                        <th className="px-2 py-1">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((fn) => (
                        <tr key={fn.id} className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                          <td className="px-2 py-1">{fn.method}</td>
                          <td className="px-2 py-1">{fn.path}</td>
                          <td className="px-2 py-1">{fn.name}</td>
                          <td className="px-2 py-1">
                            <button className="btn-secondary" onClick={() => setTesterFromFunction(fn)}>
                              Use in Tester
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <h4 className="font-semibold">Documentation Coverage</h4>
        {docsError && <div className="text-sm text-rose-600">{docsError}</div>}
        <div className="grid gap-2 text-sm md:grid-cols-3">
          <div className="rounded border p-2" style={{ borderColor: 'var(--border-muted)' }}>Documented: {documentedFunctions.length}</div>
          <div className="rounded border p-2" style={{ borderColor: 'var(--border-muted)' }}>Live: {functions.length}</div>
          <div className="rounded border p-2" style={{ borderColor: 'var(--border-muted)' }}>
            Both: {coverageMatrix.filter((row) => row.source === 'both').length}
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border-muted)' }}>
                <th className="px-2 py-1">Method</th>
                <th className="px-2 py-1">Path</th>
                <th className="px-2 py-1">Source</th>
              </tr>
            </thead>
            <tbody>
              {coverageMatrix.map((row) => (
                <tr key={`${row.method}:${row.path}`} className="border-b" style={{ borderColor: 'var(--border-muted)' }}>
                  <td className="px-2 py-1">{row.method}</td>
                  <td className="px-2 py-1">{row.path}</td>
                  <td className="px-2 py-1">{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(docsMissingInLive.length > 0 || liveMissingInDocs.length > 0) && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <h5 className="mb-1 text-sm font-semibold">Documented But Not Live ({docsMissingInLive.length})</h5>
              <div className="max-h-44 overflow-auto rounded border p-2 text-xs" style={{ borderColor: 'var(--border-muted)' }}>
                {docsMissingInLive.map((row) => (
                  <div key={`${row.method}:${row.path}`}>{row.method} {row.path}</div>
                ))}
              </div>
            </div>
            <div>
              <h5 className="mb-1 text-sm font-semibold">Live But Not Documented ({liveMissingInDocs.length})</h5>
              <div className="max-h-44 overflow-auto rounded border p-2 text-xs" style={{ borderColor: 'var(--border-muted)' }}>
                {liveMissingInDocs.map((row) => (
                  <div key={`${row.method}:${row.path}`}>{row.method} {row.path}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <h4 className="font-semibold">Advanced Function Tester</h4>
        <div className="grid gap-2 md:grid-cols-3">
          <select value={testerMethod} onChange={(event) => setTesterMethod(event.target.value)}>
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>PATCH</option>
            <option>DELETE</option>
          </select>
          <input
            className="md:col-span-2"
            value={testerPath}
            onChange={(event) => setTesterPath(event.target.value)}
            placeholder="/api/system/status"
          />
        </div>
        <input
          value={testerQuery}
          onChange={(event) => setTesterQuery(event.target.value)}
          placeholder="query params e.g. limit=50&action=model_upload"
        />
        <textarea
          rows={10}
          value={testerBody}
          onChange={(event) => setTesterBody(event.target.value)}
          placeholder="JSON body for POST/PUT/PATCH"
        />
        <div>
          <button className="btn-primary" onClick={runTester} disabled={testerLoading}>
            {testerLoading ? 'Running...' : 'Run Function'}
          </button>
        </div>
        {testerResult && (
          <div className="rounded border p-3 text-xs" style={{ borderColor: 'var(--border-muted)', background: 'var(--bg-muted)' }}>
            <div className="mb-2">
              Status:
              <span className={`ml-2 status-badge ${testerResult.ok ? 'status-ok' : 'status-warn'}`}>
                {testerResult.status}
              </span>
            </div>
            <pre className="overflow-auto">{JSON.stringify(testerResult.data, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
