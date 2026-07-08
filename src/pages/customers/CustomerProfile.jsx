import { useState, useEffect } from 'react'
import api from '../../api/axios'
import { X, Phone, Briefcase, Calendar, Receipt, IndianRupee, Clock, CheckCircle, XCircle, Star } from 'lucide-react'

const TIER_CONFIG = {
  VIP:     { color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', label: '💎 VIP' },
  Loyal:   { color: '#b45309', bg: '#fffbeb', border: '#fcd34d', label: '🥇 Loyal' },
  Regular: { color: '#0369a1', bg: '#eff6ff', border: '#bae6fd', label: '🥈 Regular' },
  New:     { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', label: '🥉 New' },
}

const SESSION_STATUS = {
  Completed:  { color: '#16a34a', bg: '#f0fdf4', icon: CheckCircle },
  Scheduled:  { color: '#2563eb', bg: '#eff6ff', icon: Clock },
  Cancelled:  { color: '#dc2626', bg: '#fef2f2', icon: XCircle },
}

const INV_STATUS = {
  Paid:           { color: '#16a34a', bg: '#f0fdf4' },
  'Partially Paid':{ color: '#b45309', bg: '#fffbeb' },
  Sent:           { color: '#2563eb', bg: '#eff6ff' },
  Draft:          { color: '#64748b', bg: '#f1f5f9' },
  Cancelled:      { color: '#dc2626', bg: '#fef2f2' },
}

export default function CustomerProfile({ customerId, onClose }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('sessions') // sessions | billing

  useEffect(() => {
    setLoading(true)
    api.get(`/customers/${customerId}`)
      .then(r => setProfile(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [customerId])

  if (loading) return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.panel}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div className="spinner" />
        </div>
      </div>
    </div>
  )

  if (!profile) return null

  const tier   = TIER_CONFIG[profile.loyalty_tier] || TIER_CONFIG.New
  const fmt    = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.panel}>

        {/* ── Header ── */}
        <div style={styles.header}>
          <div style={styles.avatarWrap}>
            <div style={styles.avatar}>{profile.name[0].toUpperCase()}</div>
            <div>
              <div style={styles.customerName}>{profile.name}</div>
              <div style={styles.customerMeta}>
                <Phone size={12} style={{ flexShrink: 0 }} /> {profile.phone}
                <span style={styles.dot}>·</span>
                <Briefcase size={12} style={{ flexShrink: 0 }} /> {profile.service}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ ...styles.tierBadge, background: tier.bg, color: tier.color, border: `1.5px solid ${tier.border}` }}>
              {tier.label}
            </span>
            <button style={styles.closeBtn} onClick={onClose}><X size={17} /></button>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div style={styles.statsRow}>
          <StatBox label="Total Sessions"  value={profile.total_sessions}                  sub={`${profile.completed_sessions} completed`} color="#2563eb" />
          <StatBox label="Total Revenue"   value={fmt(profile.total_paid)}                  sub="collected"                                  color="#16a34a" />
          <StatBox label="Outstanding Due" value={fmt(profile.total_due)}                   sub="pending"                                    color={parseFloat(profile.total_due) > 0 ? '#dc2626' : '#16a34a'} />
          <StatBox label="First Visit"     value={fmtDate(profile.first_session_date)}      sub={`Last: ${fmtDate(profile.last_session_date)}`} color="#7c3aed" small />
        </div>

        {/* ── Source + Joined ── */}
        <div style={styles.metaBar}>
          <span style={styles.metaItem}><Star size={12} /> Source: <strong>{profile.source}</strong></span>
          <span style={styles.metaDot}>·</span>
          <span style={styles.metaItem}><Calendar size={12} /> Converted: <strong>{fmtDate(profile.converted_date)}</strong></span>
          {profile.upcoming_sessions > 0 && (
            <>
              <span style={styles.metaDot}>·</span>
              <span style={{ ...styles.metaItem, color: '#2563eb', fontWeight: 600 }}>
                <Clock size={12} /> {profile.upcoming_sessions} session{profile.upcoming_sessions > 1 ? 's' : ''} upcoming
              </span>
            </>
          )}
        </div>

        {/* ── Tabs ── */}
        <div style={styles.tabs}>
          <button style={{ ...styles.tab, ...(tab === 'sessions' ? styles.tabActive : {}) }} onClick={() => setTab('sessions')}>
            <Calendar size={14} /> Sessions
            <span style={styles.tabCount}>{profile.sessions?.length || 0}</span>
          </button>
          <button style={{ ...styles.tab, ...(tab === 'billing' ? styles.tabActive : {}) }} onClick={() => setTab('billing')}>
            <Receipt size={14} /> Billing
            <span style={styles.tabCount}>{profile.invoices?.length || 0}</span>
          </button>
        </div>

        {/* ── Tab Content ── */}
        <div style={styles.tabBody}>

          {/* Sessions Tab */}
          {tab === 'sessions' && (
            profile.sessions?.length === 0 ? (
              <EmptyState icon={<Calendar size={32} />} text="No sessions yet" />
            ) : (
              <div style={styles.timeline}>
                {profile.sessions.map((s, i) => {
                  const sc = SESSION_STATUS[s.status] || SESSION_STATUS.Scheduled
                  const Icon = sc.icon
                  return (
                    <div key={s.id} style={styles.timelineItem}>
                      <div style={styles.timelineDot}>
                        <div style={{ ...styles.dot2, background: sc.bg, color: sc.color }}>
                          <Icon size={14} />
                        </div>
                        {i < profile.sessions.length - 1 && <div style={styles.timelineLine} />}
                      </div>
                      <div style={styles.timelineCard}>
                        <div style={styles.timelineTop}>
                          <div style={styles.timelineService}>{s.service}</div>
                          <span style={{ ...styles.smallBadge, background: sc.bg, color: sc.color }}>{s.status}</span>
                        </div>
                        <div style={styles.timelineMeta}>
                          <Calendar size={11} />
                          {fmtDate(s.session_date)} at {s.session_time}
                          <span style={styles.metaDot}>·</span>
                          {s.duration}
                          <span style={styles.metaDot}>·</span>
                          {s.mode === 'online' ? '🖥 Online' : '📍 Offline'}
                          {s.staff_name && (
                            <><span style={styles.metaDot}>·</span>{s.staff_name}</>
                          )}
                        </div>
                        {s.notes && <div style={styles.timelineNotes}>{s.notes}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* Billing Tab */}
          {tab === 'billing' && (
            <>
              {/* Payments summary at top */}
              {profile.payments?.length > 0 && (
                <div style={styles.paymentsBox}>
                  <div style={styles.sectionLabel}>
                    <IndianRupee size={13} /> Payment History
                  </div>
                  <div style={styles.paymentsList}>
                    {profile.payments.map((p, i) => (
                      <div key={i} style={styles.paymentRow}>
                        <div>
                          <span style={styles.payMode}>{p.payment_mode}</span>
                          <span style={styles.payInv}> · {p.invoice_number}</span>
                          {p.notes && <span style={styles.payNote}> · {p.notes}</span>}
                        </div>
                        <div style={styles.payRight}>
                          <span style={styles.payDate}>{fmtDate(p.payment_date)}</span>
                          <span style={styles.payAmt}>{fmt(p.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invoice list */}
              {profile.invoices?.length === 0 ? (
                <EmptyState icon={<Receipt size={32} />} text="No invoices yet" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={styles.sectionLabel}>
                    <Receipt size={13} /> Invoices
                  </div>
                  {profile.invoices.map(inv => {
                    const is = INV_STATUS[inv.status] || INV_STATUS.Draft
                    const due = parseFloat(inv.due_amount)
                    return (
                      <div key={inv.id} style={styles.invoiceCard}>
                        <div style={styles.invoiceTop}>
                          <div>
                            <div style={styles.invoiceNum}>{inv.invoice_number}</div>
                            <div style={styles.invoiceDate}>{fmtDate(inv.created_at)}</div>
                          </div>
                          <span style={{ ...styles.smallBadge, background: is.bg, color: is.color }}>{inv.status}</span>
                        </div>

                        {/* Line items */}
                        {inv.items?.length > 0 && (
                          <div style={styles.itemsWrap}>
                            {inv.items.map((it, j) => (
                              <div key={j} style={styles.itemRow}>
                                <span style={styles.itemDesc}>{it.description}</span>
                                <span style={styles.itemAmt}>{it.quantity} × {fmt(it.unit_price)}</span>
                                <span style={styles.itemTotal}>{fmt(it.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Invoice totals */}
                        <div style={styles.invoiceTotals}>
                          {parseFloat(inv.gst_rate) > 0 && (
                            <div style={styles.totalRow}>
                              <span>GST ({inv.gst_rate}%)</span>
                              <span>{fmt(inv.gst_amount)}</span>
                            </div>
                          )}
                          <div style={{ ...styles.totalRow, fontWeight: 700, color: '#1e293b' }}>
                            <span>Total</span><span>{fmt(inv.total_amount)}</span>
                          </div>
                          {parseFloat(inv.paid_amount) > 0 && (
                            <div style={{ ...styles.totalRow, color: '#16a34a' }}>
                              <span>Paid</span><span>{fmt(inv.paid_amount)}</span>
                            </div>
                          )}
                          {due > 0 && (
                            <div style={{ ...styles.totalRow, color: '#dc2626', fontWeight: 700 }}>
                              <span>Due</span><span>{fmt(due)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, sub, color, small }) {
  return (
    <div style={styles.statBox}>
      <div style={{ ...styles.statValue, color, fontSize: small ? 13 : 18 }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statSub}>{sub}</div>
    </div>
  )
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 0', color: 'var(--gray-300)' }}>
      {icon}
      <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>{text}</span>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 20
  },
  panel: {
    background: '#fff', borderRadius: 16,
    width: '100%', maxWidth: 660,
    maxHeight: '92vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,.18)', overflow: 'hidden'
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '20px 22px 16px',
    borderBottom: '1px solid var(--gray-100)',
    background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)'
  },
  avatarWrap: { display: 'flex', alignItems: 'center', gap: 14 },
  avatar: {
    width: 52, height: 52,
    background: 'var(--blue-600)', color: '#fff',
    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-head)', flexShrink: 0
  },
  customerName: { fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 800, color: 'var(--gray-900)' },
  customerMeta: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gray-500)', marginTop: 4 },
  dot: { color: 'var(--gray-300)' },
  tierBadge: { padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700 },
  closeBtn: { background: 'none', border: 'none', color: 'var(--gray-400)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', cursor: 'pointer' },

  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid var(--gray-100)' },
  statBox: { padding: '14px 16px', borderRight: '1px solid var(--gray-100)', display: 'flex', flexDirection: 'column', gap: 2 },
  statValue: { fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 800, lineHeight: 1.2 },
  statLabel: { fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 },
  statSub: { fontSize: 11, color: 'var(--gray-400)', marginTop: 1 },

  metaBar: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '10px 20px', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)', fontSize: 12, color: 'var(--gray-500)' },
  metaItem: { display: 'flex', alignItems: 'center', gap: 4 },
  metaDot: { color: 'var(--gray-300)' },

  tabs: { display: 'flex', borderBottom: '1px solid var(--gray-100)', padding: '0 20px', gap: 4 },
  tab: { display: 'flex', alignItems: 'center', gap: 6, padding: '12px 14px', border: 'none', background: 'none', fontSize: 13, fontWeight: 600, color: 'var(--gray-400)', cursor: 'pointer', borderBottom: '2.5px solid transparent', marginBottom: -1 },
  tabActive: { color: 'var(--blue-600)', borderBottomColor: 'var(--blue-600)' },
  tabCount: { background: 'var(--gray-100)', color: 'var(--gray-500)', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 },

  tabBody: { flex: 1, overflowY: 'auto', padding: '18px 20px' },

  timeline: { display: 'flex', flexDirection: 'column', gap: 0 },
  timelineItem: { display: 'flex', gap: 12 },
  timelineDot: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 2 },
  dot2: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  timelineLine: { width: 2, flex: 1, background: 'var(--gray-100)', margin: '4px 0', minHeight: 12 },
  timelineCard: { flex: 1, paddingBottom: 16, paddingTop: 2 },
  timelineTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 },
  timelineService: { fontSize: 14, fontWeight: 700, color: 'var(--gray-800)' },
  timelineMeta: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, fontSize: 11, color: 'var(--gray-400)' },
  timelineNotes: { marginTop: 6, fontSize: 12, color: 'var(--gray-500)', background: 'var(--gray-50)', borderRadius: 6, padding: '6px 10px', borderLeft: '3px solid var(--gray-200)' },

  smallBadge: { padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, flexShrink: 0 },

  paymentsBox: { background: 'var(--green-50)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, border: '1px solid #bbf7d0' },
  sectionLabel: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--gray-500)', marginBottom: 10 },
  paymentsList: { display: 'flex', flexDirection: 'column', gap: 6 },
  paymentRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--gray-600)' },
  payMode: { fontWeight: 700, color: 'var(--gray-800)' },
  payInv: { color: 'var(--blue-600)', fontWeight: 500 },
  payNote: { color: 'var(--gray-400)' },
  payRight: { display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 },
  payDate: { color: 'var(--gray-400)', fontSize: 11 },
  payAmt: { fontWeight: 700, color: '#16a34a', fontSize: 13 },

  invoiceCard: { border: '1.5px solid var(--gray-100)', borderRadius: 10, overflow: 'hidden', marginBottom: 10 },
  invoiceTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)' },
  invoiceNum: { fontFamily: 'var(--font-head)', fontSize: 14, fontWeight: 700, color: 'var(--blue-700)' },
  invoiceDate: { fontSize: 11, color: 'var(--gray-400)', marginTop: 2 },
  itemsWrap: { padding: '10px 14px', borderBottom: '1px solid var(--gray-100)', display: 'flex', flexDirection: 'column', gap: 6 },
  itemRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 },
  itemDesc: { flex: 1, color: 'var(--gray-700)' },
  itemAmt: { color: 'var(--gray-400)', fontSize: 11 },
  itemTotal: { fontWeight: 600, color: 'var(--gray-800)', minWidth: 70, textAlign: 'right' },
  invoiceTotals: { padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 },
  totalRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gray-500)' },
}
