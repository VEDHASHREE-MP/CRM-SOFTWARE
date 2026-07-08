import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useToast } from '../context/ToastContext'
import api from '../api/axios'

const PAGE_TITLES = {
  '/dashboard':  'Dashboard',
  '/enquiries':  'Enquiry Management',
  '/sessions':   'Session Management',
  '/team':       'Team Management',
  '/billing':    'Billing',
  '/customers':  'Customers',
  '/reports':    'Reports',
  '/inventory':  'Inventory',
  '/settings':   'Settings',
}

export default function Layout() {
  const location = useLocation()
  const { addToast, showReminder } = useToast()
  const title = PAGE_TITLES[location.pathname] || 'Virtual Tech CRM'

  useEffect(() => {
    const checkDue = async () => {
      try {
        // Enquiry follow-ups due today
        const eq = await api.get('/enquiries/notifications/due-today')
        if (eq.data.length > 0) showReminder(eq.data)

        // Sessions due today
        const sess = await api.get('/sessions/due-today')
        sess.data.forEach(s => {
          const time = s.session_time
            ? (() => { const [h,m] = s.session_time.split(':'); const hr = parseInt(h); return `${hr%12||12}:${m} ${hr>=12?'PM':'AM'}` })()
            : ''
          addToast(
            `Session with ${s.customer_name} (${s.service}) at ${time}`,
            'reminder',
            '📅 Session Today',
            0
          )
        })
      } catch {}
    }
    checkDue()
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ marginLeft: 'var(--sidebar-w)', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Topbar title={title} />
        <main style={{
          marginTop: 'var(--topbar-h)',
          padding: '28px 28px',
          flex: 1,
          minHeight: 'calc(100vh - var(--topbar-h))'
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
