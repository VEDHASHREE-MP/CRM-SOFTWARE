import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, TrendingUp, Clock, CheckCircle, XCircle, Plus,
  Calendar, CalendarCheck, Receipt, IndianRupee, AlertCircle,
  Banknote
} from 'lucide-react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import LowStockWidget from './inventory/LowStockWidget'
const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function Dashboard() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [eStats, setEStats]             = useState(null)
  const [sStats, setSStats]             = useState(null)
  const [billingStats, setBillingStats] = useState(null)
  const [recentEnquiries, setRecentEnquiries] = useState([])
  const [recentSessions, setRecentSessions]   = useState([])
  const [loading, setLoading] = useState(true)
  const [inventoryStats, setInventoryStats] = useState(null);
  useEffect(() => {
    const calls = [
      api.get('/enquiries/stats/summary'),   // 0
      api.get('/sessions/stats/summary'),    // 1
      api.get('/enquiries/'),                // 2
      api.get('/sessions/'),                 // 3
      isAdmin ? api.get('/billing/stats/summary')   : Promise.resolve(null),  // 4
      isAdmin ? api.get('/inventory/stats/summary') : Promise.resolve(null),  // 5
    ]

    // allSettled so one failing endpoint never wipes the rest
    Promise.allSettled(calls)
      .then(([eRes, sRes, eqRes, sessRes, billRes, inRes]) => {
        if (eRes.status    === 'fulfilled') setEStats(eRes.value.data)
        if (sRes.status    === 'fulfilled') setSStats(sRes.value.data)
        if (eqRes.status   === 'fulfilled') setRecentEnquiries(eqRes.value.data.slice(0, 5))
        if (sessRes.status === 'fulfilled') setRecentSessions(sessRes.value.data.slice(0, 5))
        if (billRes.status === 'fulfilled' && billRes.value) setBillingStats(billRes.value.data)
        if (inRes.status   === 'fulfilled' && inRes.value)   setInventoryStats(inRes.value.data)
      })
      .finally(() => setLoading(false))
  }, [isAdmin])

  const statusBadge = (status) => {
    const map = { 'New': 'badge-new', 'Follow-up': 'badge-followup', 'Converted': 'badge-converted', 'Closed': 'badge-closed' }
    return <span className={`badge ${map[status] || 'badge-new'}`}>{status}</span>
  }

  const sessionBadge = (status) => {
    const map = { 'Scheduled': 'badge-new', 'Completed': 'badge-converted', 'Cancelled': 'badge-closed' }
    return <span className={`badge ${map[status] || 'badge-new'}`}>{status}</span>
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  const enquiryCards = [
    { label: 'Total Enquiries',   value: eStats?.total,                 icon: ClipboardList, color: '#2563eb', bg: '#eff6ff' },
    { label: 'Follow-up Pending', value: eStats?.follow_up,             icon: Clock,         color: '#b45309', bg: '#fffbeb' },
    { label: 'Converted',         value: eStats?.converted,             icon: CheckCircle,   color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Conversion Rate',   value: `${eStats?.conversion_rate}%`, icon: TrendingUp,    color: '#7c3aed', bg: '#f5f3ff' },
  ]

  const sessionCards = [
    { label: 'Total Sessions', value: sStats?.total,     icon: Calendar,      color: '#2563eb', bg: '#eff6ff' },
    { label: 'Today',          value: sStats?.today,     icon: CalendarCheck, color: '#b45309', bg: '#fffbeb' },
    { label: 'Completed',      value: sStats?.completed, icon: CheckCircle,   color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Scheduled',      value: sStats?.scheduled, icon: Clock,         color: '#7c3aed', bg: '#f5f3ff' },
  ]

  const billingCards = billingStats ? [
    { label: "Today's Revenue",   value: fmt(billingStats.revenue_today),  icon: Banknote,      color: '#16a34a', bg: '#f0fdf4', link: '/billing' },
    { label: 'Month Revenue',     value: fmt(billingStats.revenue_month),  icon: TrendingUp,    color: '#2563eb', bg: '#eff6ff', link: '/billing' },
    { label: 'Total Invoiced',    value: fmt(billingStats.total_invoiced), icon: Receipt,       color: '#7c3aed', bg: '#f5f3ff', link: '/billing' },
    { label: 'Outstanding Dues',  value: fmt(billingStats.total_due),      icon: AlertCircle,   color: '#dc2626', bg: '#fef2f2', link: '/billing' },
  ] : []

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋</div>
          <div className="page-subtitle">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/enquiries')}>
          <Plus size={15} /> New Enquiry
        </button>
      </div>

      {/* ── Enquiry Stats ── */}
      <div style={styles.sectionLabel}>📋 Enquiries</div>
      <div style={styles.grid}>
        {enquiryCards.map((card, i) => <StatCard key={i} card={card} />)}
      </div>

      {/* ── Session Stats ── */}
      <div style={{ ...styles.sectionLabel, marginTop: 24 }}>🗓️ Sessions</div>
      <div style={styles.grid}>
        {sessionCards.map((card, i) => <StatCard key={i} card={card} />)}
      </div>

      {/* ── Billing Summary (admin only) ── */}
      {isAdmin && billingStats && (
        <>
          <div style={{ ...styles.sectionLabel, marginTop: 24 }}>💰 Billing</div>
          <div style={styles.grid}>
            {billingCards.map((card, i) => (
              <StatCard key={i} card={card} onClick={() => navigate(card.link)} clickable />
            ))}
          </div>
        </>
      )}
      {/* ── Low Stock Alert (admin only) ── */}
      {isAdmin && inventoryStats && inventoryStats.low_stock_count > 0 && (
        <>
          <div style={{ ...styles.sectionLabel, marginTop: 24 }}>📦 Inventory Alerts</div>
          <LowStockWidget stats={inventoryStats} />
        </>
      )}
      {/* ── Recent tables side by side ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 28 }}>
        {/* Recent Enquiries */}
        <div className="card">
          <div style={styles.tableHeader}>
            <div style={styles.tableTitle}>Recent Enquiries</div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/enquiries')}>View all →</button>
          </div>
          <div className="table-wrap">
            {recentEnquiries.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 20px' }}>
                <div className="empty-state-title">No enquiries yet</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Service</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEnquiries.map(e => (
                    <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/enquiries')}>
                      <td style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{e.name}</td>
                      <td style={{ fontSize: 13 }}>{e.service}</td>
                      <td>{statusBadge(e.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Upcoming Sessions */}
        <div className="card">
          <div style={styles.tableHeader}>
            <div style={styles.tableTitle}>Upcoming Sessions</div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/sessions')}>View all →</button>
          </div>
          <div className="table-wrap">
            {recentSessions.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 20px' }}>
                <div className="empty-state-title">No sessions yet</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSessions.map(s => (
                    <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/sessions')}>
                      <td style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{s.customer_name}</td>
                      <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                        {new Date(s.session_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                      <td>{sessionBadge(s.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ card, onClick, clickable }) {
  const Icon = card.icon
  return (
    <div
      className="card"
      style={{ ...styles.statCard, ...(clickable ? { cursor: 'pointer' } : {}) }}
      onClick={onClick}
      title={clickable ? 'Click to view details' : undefined}
    >
      <div style={{ ...styles.iconWrap, background: card.bg }}>
        <Icon size={20} color={card.color} />
      </div>
      <div>
        <div style={{ ...styles.statValue, ...(clickable ? { color: card.color } : {}) }}>
          {card.value ?? '—'}
        </div>
        <div style={styles.statLabel}>{card.label}</div>
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

const styles = {
  sectionLabel: {
    fontSize: 13, fontWeight: 700, color: 'var(--gray-500)',
    letterSpacing: '.04em', marginBottom: 12
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 16
  },
  statCard: {
    padding: '18px 20px',
    display: 'flex', alignItems: 'center', gap: 14
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
  },
  statValue: {
    fontFamily: 'var(--font-head)', fontSize: 26, fontWeight: 700,
    color: 'var(--gray-900)', lineHeight: 1
  },
  statLabel: { fontSize: 12, color: 'var(--gray-400)', marginTop: 4, fontWeight: 500 },
  tableHeader: {
    padding: '16px 20px', borderBottom: '1px solid var(--gray-100)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
  },
  tableTitle: {
    fontFamily: 'var(--font-head)', fontWeight: 700,
    fontSize: 15, color: 'var(--gray-900)'
  }
}