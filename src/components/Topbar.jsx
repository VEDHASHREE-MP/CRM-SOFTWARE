import { useState, useEffect, useRef } from 'react'
import { Bell, X, CheckCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

export default function Topbar({ title }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const dropdownRef = useRef()

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/enquiries/notifications/all')
      setNotifications(res.data)
      setUnread(res.data.filter(n => !n.is_read).length)
    } catch {}
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAllRead = async () => {
    await api.patch('/enquiries/notifications/mark-all-read')
    fetchNotifications()
  }

  const markRead = async (id) => {
    await api.patch(`/enquiries/notifications/${id}/read`)
    fetchNotifications()
  }

  return (
    <header style={styles.topbar}>
      <div style={styles.titleArea}>
        <h1 style={styles.title}>{title}</h1>
      </div>

      <div style={styles.actions}>
        {/* Notification bell */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            style={{ ...styles.iconBtn, ...(open ? styles.iconBtnActive : {}) }}
            onClick={() => setOpen(o => !o)}
          >
            <Bell size={18} />
            {unread > 0 && (
              <span style={styles.badge}>{unread > 9 ? '9+' : unread}</span>
            )}
          </button>

          {open && (
            <div style={styles.dropdown}>
              <div style={styles.dropdownHeader}>
                <span style={styles.dropdownTitle}>Notifications</span>
                {unread > 0 && (
                  <button style={styles.markAllBtn} onClick={markAllRead}>
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>

              <div style={styles.notifList}>
                {notifications.length === 0 ? (
                  <div style={styles.emptyNotif}>No notifications</div>
                ) : (
                  notifications.slice(0, 15).map(n => (
                    <div
                      key={n.id}
                      style={{ ...styles.notifItem, ...(n.is_read ? {} : styles.notifUnread) }}
                      onClick={() => !n.is_read && markRead(n.id)}
                    >
                      <div style={styles.notifDot(n.is_read)} />
                      <div style={{ flex: 1 }}>
                        <div style={styles.notifMsg}>{n.message}</div>
                        <div style={styles.notifTime}>
                          {new Date(n.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User chip */}
        <div style={styles.userChip}>
          <div style={styles.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
          <span style={styles.userName}>{user?.name}</span>
        </div>
      </div>
    </header>
  )
}

const styles = {
  topbar: {
    height: 'var(--topbar-h)',
    background: '#fff',
    borderBottom: '1px solid var(--gray-200)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    position: 'fixed',
    top: 0,
    left: 'var(--sidebar-w)',
    right: 0,
    zIndex: 90,
    boxShadow: '0 1px 4px rgba(0,0,0,.04)'
  },
  titleArea: {},
  title: {
    fontFamily: 'var(--font-head)',
    fontSize: 17,
    fontWeight: 700,
    color: 'var(--gray-900)'
  },
  actions: { display: 'flex', alignItems: 'center', gap: 10 },
  iconBtn: {
    position: 'relative',
    background: 'none',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--gray-200)',
    borderRadius: 8,
    width: 36, height: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--gray-600)',
    transition: 'all 150ms'
  },
  iconBtnActive: { background: 'var(--blue-50)', borderColor: 'var(--blue-200)', color: 'var(--blue-600)' },
  badge: {
    position: 'absolute', top: -5, right: -5,
    background: 'var(--red-500)', color: '#fff',
    borderRadius: 99, fontSize: 10, fontWeight: 700,
    minWidth: 17, height: 17,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 3px',
    border: '2px solid #fff'
  },
  dropdown: {
    position: 'absolute', top: 44, right: 0,
    width: 340,
    background: '#fff',
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
    zIndex: 200
  },
  dropdownHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--gray-100)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  dropdownTitle: { fontSize: 14, fontWeight: 700, color: 'var(--gray-900)' },
  markAllBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'none', border: 'none',
    fontSize: 12, color: 'var(--blue-600)', fontWeight: 500
  },
  notifList: { maxHeight: 360, overflowY: 'auto' },
  emptyNotif: { padding: '30px 16px', textAlign: 'center', fontSize: 13, color: 'var(--gray-400)' },
  notifItem: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '11px 16px',
    borderBottom: '1px solid var(--gray-50)',
    cursor: 'pointer',
    transition: 'background 150ms'
  },
  notifUnread: { background: 'var(--blue-50)' },
  notifDot: (isRead) => ({
    width: 7, height: 7,
    borderRadius: '50%',
    background: isRead ? 'var(--gray-200)' : 'var(--blue-500)',
    marginTop: 5, flexShrink: 0
  }),
  notifMsg: { fontSize: 13, color: 'var(--gray-700)', lineHeight: 1.4 },
  notifTime: { fontSize: 11, color: 'var(--gray-400)', marginTop: 3 },
  userChip: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--gray-50)',
    border: '1px solid var(--gray-200)',
    borderRadius: 99, padding: '4px 12px 4px 4px'
  },
  avatar: {
    width: 27, height: 27,
    background: 'var(--blue-600)', color: '#fff',
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700
  },
  userName: { fontSize: 13, fontWeight: 500, color: 'var(--gray-700)' }
}