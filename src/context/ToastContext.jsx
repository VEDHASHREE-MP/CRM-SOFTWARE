import { createContext, useContext, useState, useCallback } from 'react'
import { X, Bell, CheckCircle, AlertCircle, Info } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', title = '', duration = 5000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type, title }])
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showReminder = useCallback((enquiries) => {
    enquiries.forEach(e => {
      addToast(
        `Follow-up needed for ${e.name} (${e.service})`,
        'reminder',
        '📅 Follow-up Due Today',
        0  // stays until dismissed
      )
    })
  }, [addToast])

  return (
    <ToastContext.Provider value={{ addToast, removeToast, showReminder }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, onClose }) {
  if (!toasts.length) return null

  const iconMap = {
    reminder: <Bell size={18} color="#2563eb" />,
    success:  <CheckCircle size={18} color="#16a34a" />,
    error:    <AlertCircle size={18} color="#dc2626" />,
    info:     <Info size={18} color="#2563eb" />,
    assignment: <Bell size={18} color="#b45309" />
  }

  const borderMap = {
    reminder:   '#bfdbfe',
    success:    '#bbf7d0',
    error:      '#fecaca',
    info:       '#bfdbfe',
    assignment: '#fde68a'
  }

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className="toast" style={{ borderColor: borderMap[t.type] || '#e2e8f0' }}>
          <div className="toast-icon">{iconMap[t.type] || iconMap.info}</div>
          <div className="toast-body">
            {t.title && <div className="toast-title">{t.title}</div>}
            <div className="toast-msg">{t.message}</div>
          </div>
          <button className="toast-close" onClick={() => onClose(t.id)}>
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}

export const useToast = () => useContext(ToastContext)
