import { createContext, useContext, useMemo, useState } from 'react'

const initialState = {
  user: null,
  models: [],
  activeModel: null,
  dataset: null,
  metrics: null,
  shapValues: null,
  governanceReport: null,
  driftReport: null,
  trustScore: null,
  chatHistory: [],
  notifications: [],
  searchQuery: '',
}

const AppStateContext = createContext(null)

export function AppStateProvider({ children }) {
  const [state, setState] = useState(initialState)

  const actions = useMemo(
    () => ({
      patch: (partial) => setState((prev) => ({ ...prev, ...partial })),
      addNotification: (notification) =>
        setState((prev) => ({
          ...prev,
          notifications: [{ id: Date.now().toString(), ...notification }, ...prev.notifications].slice(0, 20),
        })),
      clearNotification: (id) =>
        setState((prev) => ({
          ...prev,
          notifications: prev.notifications.filter((n) => n.id !== id),
        })),
      reset: () => setState(initialState),
    }),
    []
  )

  const value = useMemo(() => ({ state, actions }), [state, actions])
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
