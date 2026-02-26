import { AnimatePresence, motion } from 'framer-motion'
import useNotifications from '../../hooks/useNotifications'

function toastClasses(type) {
  if (type === 'error') return 'border-rose-300 bg-rose-50 text-rose-700'
  if (type === 'warning') return 'border-amber-300 bg-amber-50 text-amber-700'
  return 'border-emerald-300 bg-emerald-50 text-emerald-700'
}

export default function ToastStack() {
  const { notifications, clear } = useNotifications()

  return (
    <div className="fixed right-4 top-16 z-50 space-y-2">
      <AnimatePresence>
        {notifications.map((notification) => (
          <motion.button
            key={notification.id}
            onClick={() => clear(notification.id)}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`block w-80 rounded-lg border px-4 py-3 text-left text-sm shadow-lg ${toastClasses(notification.type)}`}
          >
            <div className="font-semibold">{notification.title || 'Notification'}</div>
            {notification.message && <div className="mt-1 opacity-90">{notification.message}</div>}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
