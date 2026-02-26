import { useAuth } from '../context/AuthContext'

export default function useRequireAuth() {
  const { user, loading } = useAuth()
  return { user, loading, isAuthenticated: !!user }
}
