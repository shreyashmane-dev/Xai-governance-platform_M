import { useAppState } from '../context/AppStateContext'

export default function useNotifications() {
  const { state, actions } = useAppState()
  return {
    notifications: state.notifications,
    push: actions.addNotification,
    clear: actions.clearNotification,
  }
}
