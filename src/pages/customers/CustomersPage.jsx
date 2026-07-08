import { useState, useEffect, useCallback } from 'react'
import { Search, Pencil, ExternalLink, Users, Receipt, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { useToast } from '../../context/ToastContext'

const LOYALTY_TIERS = ['New', 'Regular', 'Loyal', 'VIP']

const TIER_STYLE = {
  VIP:     { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  Loyal:   { bg: '#ede9fe', color: '#6d28d9', border: '#c4b5fd' },
  Regular: { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
  New:     { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
}

const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function CustomersPage() {
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [tab, setTab]                   = useState('enquiry') // 'enquiry' | 'invoice'
  const [enquiryCustomers, setEnquiry]  = useState([])
  const [invoiceCustomers, setInvoice]  = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [tierFilter, setTierFilter]     = useState('')
  const [editModal, setEditModal]       = useState(null) // { type, customer }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search)     params.search = search
      if (tierFilter) params.tier   = tierFilter

      const [enqRes, invRes] = await Promise.all([
        api.get('/customers/enquiry', { params }),
        api.get('/customers/invoice', { params }),
      ])
      setEnquiry(enqRes.data)
      setInvoice(invRes.data)
    } catch {
      addToast('Failed to load customers', 'error', '❌ Error')
    } finally {
      setLoading(false)
    }
  }, [search, tierFilter])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleViewInvoices = (phone) => {
    // Navigate to billing with phone pre-filled as search
    navigate(`/billing?search=${encodeURIComponent(phone)}`)
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Customer Management</div>
          <div className="page-subtitle">
            {enquiryCustomers.length} enquiry customer{enquiryCustomers.length !== 1 ? 's' : ''} ·{' '}
            {invoiceCustomers.length} invoice customer{invoiceCustomers.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--gray-50)', border: '1.5px solid var(--gray-200)', borderRadius: 8, padding: '8px 12px' }}>
          <Search size={15} color="var(--gray-400)" />
          <input
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 15, color: 'var(--gray-700)' }}
            placeholder="Search by name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className="form-input"
          style={{ minWidth: 160, fontSize: 14 }}
          value={tierFilter}
          onChange={e => setTierFilter(e.target.value)}
        >
          <option value="">All Loyalty Tiers</option>
          {LOYALTY_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {(search || tierFilter) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setTierFilter('') }}>
            Clear
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 10, overflow: 'hidden', width: 'fit-content' }}>
        <TabBtn active={tab === 'enquiry'} onClick={() => setTab('enquiry')} icon={<Users size={15} />} label={`Session Customers (${enquiryCustomers.length})`} />
        <TabBtn active={tab === 'invoice'} onClick={() => setTab('invoice')} icon={<Receipt size={15} />} label={`Invoice Customers (${invoiceCustomers.length})`} />
      </div>

      {/* Tables */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : tab === 'enquiry' ? (
        <EnquiryTable
          customers={enquiryCustomers}
          onEdit={(c) => setEditModal({ type: 'enquiry', customer: c })}
        />
      ) : (
        <InvoiceTable
          customers={invoiceCustomers}
          onEdit={(c) => setEditModal({ type: 'invoice', customer: c })}
          onViewInvoices={handleViewInvoices}
        />
      )}

      {/* Edit modal */}
      {editModal && (
        <EditCustomerModal
          type={editModal.type}
          customer={editModal.customer}
          onClose={() => setEditModal(null)}
          onSaved={() => { setEditModal(null); fetchAll() }}
        />
      )}
    </div>
  )
}

// ── Tab Button ────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '11px 20px', border: 'none', cursor: 'pointer',
        fontSize: 14, fontWeight: active ? 700 : 500,
        background: active ? 'var(--blue-600)' : '#fff',
        color: active ? '#fff' : 'var(--gray-500)',
        transition: 'all 150ms'
      }}
    >
      {icon} {label}
    </button>
  )
}

// ── Enquiry Customers Table ───────────────────────────────────────────────────

function EnquiryTable({ customers, onEdit }) {
  if (customers.length === 0) return (
    <div className="card">
      <div className="empty-state">
        <div className="empty-state-icon">👥</div>
        <div className="empty-state-title">No session customers found</div>
        <div className="empty-state-desc">Customers appear here when their enquiry is marked as Converted</div>
      </div>
    </div>
  )

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Customer</th>
              <th>Service</th>
              <th>Source</th>
              <th>Sessions</th>
              <th>Loyalty Tier</th>
              <th style={{ textAlign: 'right' }}>Paid</th>
              <th style={{ textAlign: 'right' }}>Due</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c, i) => {
              const tier = TIER_STYLE[c.loyalty_tier] || TIER_STYLE.New
              return (
                <tr key={c.id}>
                  <td style={{ color: 'var(--gray-400)', fontSize: 13 }}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--gray-900)', fontSize: 15 }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 2 }}>{c.phone}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: 13, background: 'var(--blue-50)', color: 'var(--blue-700)', padding: '2px 10px', borderRadius: 99, fontWeight: 500 }}>
                      Session
                    </span>
                  </td>
                  <td style={{ fontSize: 14, color: 'var(--gray-500)' }}>{c.source}</td>
                  <td>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-900)' }}>{c.completed_sessions ?? 0} done</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{c.upcoming_sessions ?? 0} upcoming</div>
                  </td>
                  <td>
                    <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700, background: tier.bg, color: tier.color, border: `1px solid ${tier.border}` }}>
                      {c.loyalty_tier}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 600, color: 'var(--green-600)' }}>
                    {parseFloat(c.total_paid) > 0 ? fmt(c.total_paid) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 600, color: parseFloat(c.total_due) > 0 ? 'var(--red-600)' : 'var(--gray-300)' }}>
                    {parseFloat(c.total_due) > 0 ? fmt(c.total_due) : '—'}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => onEdit(c)} title="Edit customer">
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Invoice Customers Table ───────────────────────────────────────────────────

function InvoiceTable({ customers, onEdit, onViewInvoices }) {
  if (customers.length === 0) return (
    <div className="card">
      <div className="empty-state">
        <div className="empty-state-icon">🧾</div>
        <div className="empty-state-title">No invoice-only customers found</div>
        <div className="empty-state-desc">Customers appear here when an invoice is created without linking to a converted enquiry</div>
      </div>
    </div>
  )

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Customer</th>
              <th>Type</th>
              <th>Description</th>
              <th>Loyalty Tier</th>
              <th style={{ textAlign: 'right' }}>Invoiced</th>
              <th style={{ textAlign: 'right' }}>Paid</th>
              <th style={{ textAlign: 'right' }}>Due</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c, i) => {
              const tier = TIER_STYLE[c.loyalty_tier] || TIER_STYLE.New
              const descriptions = c.descriptions
                ? c.descriptions.split(',').filter(Boolean).slice(0, 2).join(', ')
                : '—'
              return (
                <tr key={c.id}>
                  <td style={{ color: 'var(--gray-400)', fontSize: 13 }}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--gray-900)', fontSize: 15 }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 2 }}>{c.phone}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: 13, background: 'var(--amber-50)', color: '#b45309', padding: '2px 10px', borderRadius: 99, fontWeight: 500, border: '1px solid #fde68a' }}>
                      Invoice
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--gray-600)', maxWidth: 200 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {descriptions}
                    </div>
                    {c.total_invoices > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
                        {c.total_invoices} invoice{c.total_invoices !== 1 ? 's' : ''}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700, background: tier.bg, color: tier.color, border: `1px solid ${tier.border}` }}>
                      {c.loyalty_tier}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 600, color: 'var(--gray-700)' }}>
                    {parseFloat(c.total_invoiced) > 0 ? fmt(c.total_invoiced) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 600, color: 'var(--green-600)' }}>
                    {parseFloat(c.total_paid) > 0 ? fmt(c.total_paid) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 14, fontWeight: 600, color: parseFloat(c.total_due) > 0 ? 'var(--red-600)' : 'var(--gray-300)' }}>
                    {parseFloat(c.total_due) > 0 ? fmt(c.total_due) : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => onEdit(c)} title="Edit customer">
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => onViewInvoices(c.phone)}
                        title="View invoices"
                        style={{ color: 'var(--blue-600)', fontSize: 13 }}
                      >
                        <ExternalLink size={14} /> Invoices
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Edit Customer Modal ───────────────────────────────────────────────────────

function EditCustomerModal({ type, customer, onClose, onSaved }) {
  const { addToast } = useToast()
  const [form, setForm]       = useState({
    name:         customer.name,
    phone:        customer.phone,
    loyalty_tier: customer.loyalty_tier || 'New',
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})

  const validate = () => {
    const e = {}
    if (!form.name.trim())  e.name  = 'Required'
    if (!form.phone.trim()) e.phone = 'Required'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const url = type === 'enquiry'
        ? `/customers/enquiry/${customer.id}`
        : `/customers/invoice/${customer.id}`
      await api.put(url, form)
      addToast('Customer updated', 'success', '✅ Saved')
      onSaved()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error', '❌ Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Customer</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              className="form-input"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={errors.name ? { borderColor: 'var(--red-500)' } : {}}
            />
            {errors.name && <span style={{ fontSize: 13, color: 'var(--red-500)' }}>{errors.name}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Phone *</label>
            <input
              className="form-input"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              style={errors.phone ? { borderColor: 'var(--red-500)' } : {}}
            />
            {errors.phone && <span style={{ fontSize: 13, color: 'var(--red-500)' }}>{errors.phone}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Loyalty Tier</label>
            <select
              className="form-input"
              value={form.loyalty_tier}
              onChange={e => setForm(f => ({ ...f, loyalty_tier: e.target.value }))}
            >
              {LOYALTY_TIERS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>
              New → Regular → Loyal → VIP
            </span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}