import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../../api/axios'
import { Plus, Search, Receipt, TrendingUp, Clock, AlertCircle, Trash2 } from 'lucide-react'
import InvoiceModal   from './InvoiceModal'
import PaymentModal   from './PaymentModal'
import InvoiceDetail  from './InvoiceDetail'
import { useAuth }    from '../../context/AuthContext'

const STATUS_OPTIONS = ['', 'Draft', 'Sent', 'Partially Paid', 'Paid', 'Cancelled']

const STATUS_STYLES = {
  'Draft':          { bg: 'var(--gray-100)',  color: 'var(--gray-600)' },
  'Sent':           { bg: 'var(--blue-50)',   color: 'var(--blue-700)' },
  'Partially Paid': { bg: 'var(--amber-50)',  color: '#b45309' },
  'Paid':           { bg: 'var(--green-50)',  color: 'var(--green-600)' },
  'Cancelled':      { bg: 'var(--red-50)',    color: 'var(--red-600)' },
}

export default function BillingPage() {
  const location = useLocation()
  const _params  = new URLSearchParams(location.search)
  const { isAdmin } = useAuth()

  const [invoices, setInvoices]   = useState([])
  const [stats, setStats]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState(_params.get('search') || '')
  const [statusFilter, setStatus] = useState(_params.get('status') || '')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [deleting, setDeleting]   = useState(null)   // invoice id being deleted

  const [showCreate,   setShowCreate]   = useState(false)
  const [editInvoice,  setEditInvoice]  = useState(null)
  const [viewInvoice,  setViewInvoice]  = useState(null)
  const [payInvoice,   setPayInvoice]   = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search)       params.search   = search
      if (statusFilter) params.status   = statusFilter
      if (dateFrom)     params.date_from = dateFrom
      if (dateTo)       params.date_to   = dateTo

      const [invRes, statsRes] = await Promise.all([
        api.get('/billing/', { params }),
        api.get('/billing/stats/summary'),
      ])
      setInvoices(invRes.data)
      setStats(statsRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, dateFrom, dateTo])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Load full invoice detail (with items & payments)
  const openDetail = async (inv) => {
    try {
      const res = await api.get(`/billing/${inv.id}`)
      setViewInvoice(res.data)
    } catch { setViewInvoice(inv) }
  }

  const handleSaved = (inv) => {
    setShowCreate(false)
    setEditInvoice(null)
    fetchAll()
    openDetail(inv)
  }

  const handlePaymentSaved = (updatedInvoice) => {
    setPayInvoice(null)
    setViewInvoice(updatedInvoice)
    fetchAll()
  }

const handleEditFromDetail = async (inv) => {
  try {
    const res = await api.get(`/billing/${inv.id}`)
    setViewInvoice(null)
    setEditInvoice(res.data)
  } catch (err) {
    console.error(err)
    alert('Unable to load invoice details')
  }
}

  const handlePayFromDetail = (inv) => {
    setPayInvoice(inv)
  }

  const handleDelete = async (inv, e) => {
    e.stopPropagation()
    if (!window.confirm(
      `Delete invoice ${inv.invoice_number} for ${inv.customer_name}?\n\nThis will permanently remove the invoice and all its payments. This cannot be undone.`
    )) return

    setDeleting(inv.id)
    try {
      await api.delete(`/billing/${inv.id}`)
      setViewInvoice(null)
      fetchAll()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete invoice')
    } finally {
      setDeleting(null)
    }
  }

  const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div style={styles.page}>
      {/* ── Page Header ── */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Billing & Collection</h1>
          <p style={styles.pageSubtitle}>Manage invoices, payments and dues</p>
        </div>
        <button style={styles.newBtn} onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Invoice
        </button>
      </div>

      {/* ── Stats Cards ── */}
      {stats && (
        <div style={styles.statsRow}>
          <StatCard icon={<TrendingUp size={20} />} label="Today's Revenue"   value={fmt(stats.revenue_today)}  color="blue" />
          <StatCard icon={<Receipt    size={20} />} label="Month Revenue"     value={fmt(stats.revenue_month)}  color="green" />
          <StatCard icon={<AlertCircle size={20}/>} label="Total Dues"        value={fmt(stats.total_due)}      color="red" />
          <StatCard icon={<Clock      size={20} />} label="Total Invoiced"    value={fmt(stats.total_invoiced)} color="gray" />
        </div>
      )}

      {/* ── Status Quick Filters ── */}
      <div style={styles.quickFilters}>
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            style={{ ...styles.qBtn, ...(statusFilter === s ? styles.qBtnActive : {}) }}
            onClick={() => setStatus(s)}
          >
            {s || 'All'}
            {s && stats && (
              <span style={styles.qCount}>
                {s === 'Draft' ? stats.draft_count
                  : s === 'Sent' ? stats.sent_count
                  : s === 'Paid' ? stats.paid_count
                  : s === 'Partially Paid' ? stats.partial_count
                  : ''}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Search & Date Filters ── */}
      <div style={styles.filtersBar}>
        <div style={styles.searchWrap}>
          <Search size={14} style={styles.searchIcon} />
          <input
            style={styles.searchInput}
            placeholder="Search by name, phone, invoice no…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <input type="date" style={styles.dateInput} value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
        <input type="date" style={styles.dateInput} value={dateTo}   onChange={e => setDateTo(e.target.value)}   title="To date" />
        {(search || dateFrom || dateTo || statusFilter) && (
          <button style={styles.clearBtn} onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setStatus('') }}>
            Clear
          </button>
        )}
      </div>

      {/* ── Invoice Table ── */}
      <div style={styles.tableWrap}>
        {loading ? (
          <div style={styles.emptyState}>Loading invoices…</div>
        ) : invoices.length === 0 ? (
          <div style={styles.emptyState}>
            <Receipt size={36} style={{ color: 'var(--gray-300)', marginBottom: 10 }} />
            <p style={{ color: 'var(--gray-400)', fontSize: 14 }}>No invoices found</p>
            <button style={styles.newBtn2} onClick={() => setShowCreate(true)}>Create First Invoice</button>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Invoice #</th>
                <th style={styles.th}>Customer</th>
                <th style={styles.th}>Date</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Total</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Paid</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Due</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const sc = STATUS_STYLES[inv.status] || STATUS_STYLES['Draft']
                const due = parseFloat(inv.due_amount)
                return (
                  <tr key={inv.id} style={styles.tr} onClick={() => openDetail(inv)}>
                    <td style={styles.td}>
                      <span style={styles.invNum}>{inv.invoice_number}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.customerName}>{inv.customer_name}</div>
                      <div style={styles.customerPhone}>{inv.phone}</div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.dateText}>
                        {new Date(inv.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                      {fmt(inv.total_amount)}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', color: 'var(--green-600)', fontWeight: 500 }}>
                      {parseFloat(inv.paid_amount) > 0 ? fmt(inv.paid_amount) : '—'}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', color: due > 0 ? 'var(--red-600)' : 'var(--gray-400)', fontWeight: due > 0 ? 600 : 400 }}>
                      {due > 0 ? fmt(due) : '—'}
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, background: sc.bg, color: sc.color }}>{inv.status}</span>
                    </td>
                    <td style={styles.td} onClick={e => e.stopPropagation()}>
                      <div style={styles.actions}>
                        {due > 0 && inv.status !== 'Cancelled' && (
                          <button
                            style={styles.payActionBtn}
                            onClick={() => setPayInvoice(inv)}
                            title="Record payment"
                          >
                            + Pay
                          </button>
                        )}
                        <button
  style={styles.editActionBtn}
  onClick={async () => {
    try {
      const res = await api.get(`/billing/${inv.id}`)
      setEditInvoice(res.data)
    } catch (err) {
      console.error(err)
      alert('Unable to load invoice details')
    }
  }}
>
  Edit
</button>
                        {isAdmin && (
                          <button
                            style={styles.deleteActionBtn}
                            onClick={e => handleDelete(inv, e)}
                            disabled={deleting === inv.id}
                            title="Delete invoice"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modals ── */}
      {showCreate && (
        <InvoiceModal onClose={() => setShowCreate(false)} onSaved={handleSaved} />
      )}
      {editInvoice && (
        <InvoiceModal
          invoice={editInvoice}
          onClose={() => setEditInvoice(null)}
          onSaved={handleSaved}
        />
      )}
      {viewInvoice && (
        <InvoiceDetail
          invoice={viewInvoice}
          onClose={() => setViewInvoice(null)}
          onEdit={handleEditFromDetail}
          onPayment={handlePayFromDetail}
          onDelete={isAdmin ? (inv, e) => handleDelete(inv, e) : null}
        />
      )}
      {payInvoice && (
        <PaymentModal
          invoice={payInvoice}
          onClose={() => setPayInvoice(null)}
          onSaved={handlePaymentSaved}
        />
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  const colors = {
    blue:  { bg: 'var(--blue-50)',  icon: 'var(--blue-600)',  text: 'var(--blue-700)' },
    green: { bg: 'var(--green-50)', icon: 'var(--green-600)', text: 'var(--green-600)' },
    red:   { bg: 'var(--red-50)',   icon: 'var(--red-500)',   text: 'var(--red-600)' },
    gray:  { bg: 'var(--gray-100)', icon: 'var(--gray-500)',  text: 'var(--gray-700)' },
  }
  const c = colors[color]
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, background: c.bg, color: c.icon }}>{icon}</div>
      <div>
        <div style={styles.statLabel}>{label}</div>
        <div style={{ ...styles.statValue, color: c.text }}>{value}</div>
      </div>
    </div>
  )
}

const styles = {
  page: { padding: '24px 28px', minHeight: '100vh', background: 'var(--gray-50)' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle: { fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 800, color: 'var(--gray-900)' },
  pageSubtitle: { fontSize: 13, color: 'var(--gray-400)', marginTop: 3 },
  newBtn: {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '10px 20px', background: 'var(--blue-600)',
    color: '#fff', border: 'none', borderRadius: 10,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(37,99,235,.25)'
  },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 },
  statCard: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: '#fff', borderRadius: 12,
    padding: '16px 18px',
    border: '1px solid var(--gray-100)',
    boxShadow: 'var(--shadow-sm)'
  },
  statIcon: { width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statLabel: { fontSize: 12, color: 'var(--gray-400)', fontWeight: 500 },
  statValue: { fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-head)', marginTop: 2 },
  quickFilters: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  qBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--gray-200)',
    borderRadius: 99, background: '#fff', color: 'var(--gray-500)',
    fontSize: 13, fontWeight: 500, cursor: 'pointer'
  },
  qBtnActive: { background: 'var(--blue-600)', color: '#fff', borderColor: 'var(--blue-600)', fontWeight: 600 },
  qCount: { background: 'rgba(255,255,255,.25)', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 },
  filtersBar: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' },
  searchWrap: { flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid var(--gray-200)', borderRadius: 9, padding: '8px 12px' },
  searchIcon: { color: 'var(--gray-400)', flexShrink: 0 },
  searchInput: { flex: 1, border: 'none', outline: 'none', fontSize: 13, color: 'var(--gray-700)', background: 'transparent' },
  dateInput: { padding: '8px 10px', border: '1.5px solid var(--gray-200)', borderRadius: 8, fontSize: 13, color: 'var(--gray-700)', outline: 'none' },
  clearBtn: { padding: '8px 14px', border: '1.5px solid var(--gray-200)', borderRadius: 8, background: '#fff', color: 'var(--gray-500)', fontSize: 13, cursor: 'pointer' },
  tableWrap: { background: '#fff', borderRadius: 14, border: '1px solid var(--gray-100)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 16px', background: 'var(--gray-50)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--gray-500)', textAlign: 'left', borderBottom: '1px solid var(--gray-100)' },
  tr: { cursor: 'pointer', transition: 'background 150ms' },
  td: { padding: '13px 16px', borderBottom: '1px solid var(--gray-50)', fontSize: 13, color: 'var(--gray-700)', verticalAlign: 'middle' },
  invNum: { fontFamily: 'var(--font-head)', fontWeight: 700, color: 'var(--blue-700)', fontSize: 13 },
  customerName: { fontWeight: 600, color: 'var(--gray-800)', fontSize: 13 },
  customerPhone: { fontSize: 11, color: 'var(--gray-400)', marginTop: 2 },
  dateText: { fontSize: 12, color: 'var(--gray-500)' },
  badge: { padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 },
  actions: { display: 'flex', gap: 6 },
  payActionBtn: { padding: '5px 12px', border: 'none', borderRadius: 7, background: 'var(--green-600)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  editActionBtn: { padding: '5px 12px', border: '1.5px solid var(--gray-200)', borderRadius: 7, background: '#fff', color: 'var(--gray-600)', fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  deleteActionBtn: { padding: '5px 8px', border: '1.5px solid #fecaca', borderRadius: 7, background: '#fef2f2', color: 'var(--red-600)', fontSize: 12, display: 'flex', alignItems: 'center', cursor: 'pointer' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 8 },
  newBtn2: { marginTop: 8, padding: '9px 20px', background: 'var(--blue-600)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}