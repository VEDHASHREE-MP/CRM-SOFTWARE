import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Users, ClipboardList, Calendar,
  Receipt, BarChart2, Package, Settings, LogOut, UserCog, PiggyBank
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/enquiries',  label: 'Enquiries',    icon: ClipboardList },
  { to: '/sessions',   label: 'Sessions',     icon: Calendar },
  { to: '/reports',    label: 'Reports',      icon: BarChart2 },
]

const ADMIN_ITEMS = [
  { to: '/billing',    label: 'Billing',      icon: Receipt   },
  { to: '/customers',  label: 'Customers',    icon: Users     },
  { to: '/inventory',  label: 'Inventory',    icon: Package   },
  { to: '/expenses',   label: 'Expenses',     icon: PiggyBank },
  { to: '/team',       label: 'Team',         icon: UserCog   },
   
]

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logo}>
        <div style={styles.logoMark}>VT</div>
        <div>
          <div style={styles.logoName}>Virtual Tech</div>
          <div style={styles.logoSub}>CRM System</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={styles.nav}>
        <div style={styles.navSection}>
          <span style={styles.navSectionLabel}>Main Menu</span>
          {NAV_ITEMS.map(item => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </div>

        {isAdmin && (
          <div style={styles.navSection}>
            <span style={styles.navSectionLabel}>Administration</span>
            {ADMIN_ITEMS.map(item => (
              <SidebarLink key={item.to} item={item} />
            ))}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div style={styles.footer}>
        <div style={styles.userInfo}>
          <div style={styles.avatar}>{user?.name?.[0]?.toUpperCase() || 'U'}</div>
          <div style={styles.userText}>
            <div style={styles.userName}>{user?.name}</div>
            <div style={styles.userRole}>{user?.role === 'admin' ? '⚡ Admin' : '👤 Staff'}</div>
          </div>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn} title="Logout">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}

function SidebarLink({ item }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.soon ? '#' : item.to}
      onClick={item.soon ? e => e.preventDefault() : undefined}
      style={({ isActive }) => ({
        ...styles.navLink,
        ...(isActive && !item.soon ? styles.navLinkActive : {}),
        ...(item.soon ? styles.navLinkDisabled : {})
      })}
    >
      <Icon size={17} />
      <span>{item.label}</span>
      {item.soon && <span style={styles.soonBadge}>Soon</span>}
    </NavLink>
  )
}

const styles = {
  sidebar: {
    width: 'var(--sidebar-w)',
    height: '100vh',
    background: '#fff',
    borderRight: '1px solid var(--gray-200)',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    top: 0, left: 0,
    zIndex: 100,
    boxShadow: '2px 0 8px rgba(0,0,0,.04)'
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '18px 16px 14px',
    borderBottom: '1px solid var(--gray-100)'
  },
  logoMark: {
    width: 36, height: 36,
    background: 'var(--blue-600)',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontFamily: 'var(--font-head)',
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: '.05em',
    flexShrink: 0
  },
  logoName: { fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 14, color: 'var(--gray-900)', lineHeight: 1.2 },
  logoSub:  { fontSize: 11, color: 'var(--gray-400)', marginTop: 1 },
  nav: { flex: 1, overflowY: 'auto', padding: '10px 8px' },
  navSection: { marginBottom: 20 },
  navSectionLabel: {
    display: 'block',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: 'var(--gray-400)',
    padding: '6px 8px 4px'
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: '9px 10px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--gray-600)',
    transition: 'all 150ms',
    marginBottom: 2
  },
  navLinkActive: {
    background: 'var(--blue-50)',
    color: 'var(--blue-700)',
  },
  navLinkDisabled: {
    opacity: .5,
    cursor: 'default'
  },
  soonBadge: {
    marginLeft: 'auto',
    fontSize: 10,
    background: 'var(--gray-100)',
    color: 'var(--gray-400)',
    padding: '2px 6px',
    borderRadius: 99,
    fontWeight: 600
  },
  footer: {
    padding: '12px 14px',
    borderTop: '1px solid var(--gray-100)',
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  userInfo: { display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 },
  avatar: {
    width: 32, height: 32,
    background: 'var(--blue-100)',
    color: 'var(--blue-700)',
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 13, flexShrink: 0
  },
  userText: { minWidth: 0 },
  userName: { fontSize: 13, fontWeight: 600, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userRole: { fontSize: 11, color: 'var(--gray-400)' },
  logoutBtn: {
    background: 'none', border: 'none',
    color: 'var(--gray-400)',
    padding: 6, borderRadius: 6,
    display: 'flex', alignItems: 'center',
    transition: 'all 150ms',
    flexShrink: 0
  }
}