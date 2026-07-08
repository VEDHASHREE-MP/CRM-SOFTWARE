import { useState, useEffect } from 'react'
import api from '../../api/axios'
import { X, Plus, Trash2 } from 'lucide-react'

const GST_OPTIONS = [0, 5, 12, 18, 28]
const EMPTY_ITEM  = { description: '', quantity: 1, unit_price: '' }

export default function InvoiceModal({ invoice, onClose, onSaved }) {
  const isEdit = !!invoice

  const [form, setForm] = useState({
    customer_name: invoice?.customer_name || '',
    phone:         invoice?.phone         || '',
    enquiry_id:    invoice?.enquiry_id    || '',
    gst_rate:      invoice?.gst_rate      ?? 0,
    discount:      invoice?.discount      ?? 0,
    notes:         invoice?.notes         || '',
    status:        invoice?.status        || 'Draft',
  })

  const [items, setItems] = useState(
    invoice?.items?.length
      ? invoice.items.map(i => ({ ...i }))
      : [{ ...EMPTY_ITEM }]
  )

  const [customers, setCustomers] = useState([])
  const [saving, setSaving]       = useState(false)
  const [errors, setErrors]       = useState({})

  useEffect(() => {
    api.get('/billing/customers-list').then(r => setCustomers(r.data)).catch(() => {})
  }, [])

  // ── Totals ──
  const subtotal   = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unit_price) || 0), 0)
  const afterDisc  = Math.max(0, subtotal - (parseFloat(form.discount) || 0))
  const gstAmount  = afterDisc * (parseFloat(form.gst_rate) || 0) / 100
  const total      = afterDisc + gstAmount

  // ── Item helpers ──
  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  }
  const addItem    = () => setItems(prev => [...prev, { ...EMPTY_ITEM }])
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  // ── Customer autofill ──
  const handleCustomerSelect = (e) => {
    const id = e.target.value
    setForm(f => ({ ...f, enquiry_id: id }))
    if (id) {
      const c = customers.find(c => String(c.id) === String(id))
      if (c) setForm(f => ({ ...f, enquiry_id: id, customer_name: c.name, phone: c.phone }))
    }
  }

  const validate = () => {
    const e = {}
    if (!form.customer_name.trim()) e.customer_name = 'Required'
    if (!form.phone.trim())         e.phone         = 'Required'
    if (items.every(i => !i.description.trim())) e.items = 'Add at least one item'
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        enquiry_id: form.enquiry_id || null,
        gst_rate:   parseFloat(form.gst_rate)  || 0,
        discount:   parseFloat(form.discount)  || 0,
        items: items
          .filter(i => i.description.trim())
          .map(i => ({
            description: i.description,
            quantity:    parseFloat(i.quantity)   || 1,
            unit_price:  parseFloat(i.unit_price) || 0,
          }))
      }
      const res = isEdit
        ? await api.put(`/billing/${invoice.id}`, payload)
        : await api.post('/billing/', payload)
      onSaved(res.data.invoice)
    } catch (err) {
      setErrors({ api: err.response?.data?.error || 'Failed to save invoice' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>{isEdit ? 'Edit Invoice' : 'New Invoice'}</h2>
          <button style={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={styles.body}>
          {errors.api && <div style={styles.errorBanner}>{errors.api}</div>}

          {/* ── Customer Section ── */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Customer Details</div>
            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Link to Converted Enquiry</label>
                <select style={styles.input} value={form.enquiry_id} onChange={handleCustomerSelect}>
                  <option value="">— Select customer (optional) —</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Customer Name *</label>
                <input
                  style={{ ...styles.input, ...(errors.customer_name ? styles.inputError : {}) }}
                  value={form.customer_name}
                  onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                  placeholder="Full name"
                />
                {errors.customer_name && <span style={styles.errText}>{errors.customer_name}</span>}
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Phone *</label>
                <input
                  style={{ ...styles.input, ...(errors.phone ? styles.inputError : {}) }}
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="10-digit number"
                />
                {errors.phone && <span style={styles.errText}>{errors.phone}</span>}
              </div>
            </div>
          </div>

          {/* ── Line Items ── */}
          <div style={styles.section}>
            <div style={styles.sectionTitleRow}>
              <span style={styles.sectionTitle}>Services / Items</span>
              <button style={styles.addItemBtn} onClick={addItem}><Plus size={14} /> Add Row</button>
            </div>

            {errors.items && <div style={styles.errText}>{errors.items}</div>}

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: '45%' }}>Description</th>
                  <th style={{ ...styles.th, width: '15%', textAlign: 'right' }}>Qty</th>
                  <th style={{ ...styles.th, width: '20%', textAlign: 'right' }}>Unit Price (₹)</th>
                  <th style={{ ...styles.th, width: '15%', textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ ...styles.th, width: '5%' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const amt = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)
                  return (
                    <tr key={idx}>
                      <td style={styles.td}>
                        <input
                          style={styles.tableInput}
                          value={item.description}
                          onChange={e => updateItem(idx, 'description', e.target.value)}
                          placeholder="e.g. Web Design Service"
                        />
                      </td>
                      <td style={styles.td}>
                        <input
                          style={{ ...styles.tableInput, textAlign: 'right' }}
                          type="number" min="0.01" step="0.01"
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', e.target.value)}
                        />
                      </td>
                      <td style={styles.td}>
                        <input
                          style={{ ...styles.tableInput, textAlign: 'right' }}
                          type="number" min="0" step="0.01"
                          value={item.unit_price}
                          onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 500 }}>
                        ₹{amt.toFixed(2)}
                      </td>
                      <td style={styles.td}>
                        {items.length > 1 && (
                          <button style={styles.removeBtn} onClick={() => removeItem(idx)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Totals ── */}
          <div style={styles.totalsRow}>
            <div style={styles.gstDiscRow}>
              <div style={styles.field}>
                <label style={styles.label}>Discount (₹)</label>
                <input
                  style={{ ...styles.input, width: 120 }}
                  type="number" min="0" step="0.01"
                  value={form.discount}
                  onChange={e => setForm(f => ({ ...f, discount: e.target.value }))}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>GST Rate</label>
                <select
                  style={{ ...styles.input, width: 120 }}
                  value={form.gst_rate}
                  onChange={e => setForm(f => ({ ...f, gst_rate: e.target.value }))}
                >
                  {GST_OPTIONS.map(g => <option key={g} value={g}>{g}%</option>)}
                </select>
              </div>
            </div>

            <div style={styles.totalsBox}>
              <TotalRow label="Subtotal"   value={subtotal} />
              {parseFloat(form.discount) > 0 && (
                <TotalRow label="Discount" value={-parseFloat(form.discount) || 0} neg />
              )}
              {parseFloat(form.gst_rate) > 0 && (
                <TotalRow label={`GST (${form.gst_rate}%)`} value={gstAmount} />
              )}
              <div style={styles.totalDivider} />
              <TotalRow label="Total" value={total} bold />
            </div>
          </div>

          {/* ── Status & Notes ── */}
          <div style={styles.section}>
            <div style={styles.row}>
              <div style={styles.field}>
  <label style={styles.label}>Status</label>
  <select
    style={styles.input}
    value={form.status}
    onChange={e => setForm(f => ({
      ...f,
      status: e.target.value
    }))}
  >
    {[
      'Draft',
      'Sent',
      'Partially Paid',
      'Paid',
      'Cancelled'
    ].map(s => (
      <option key={s} value={s}>
        {s}
      </option>
    ))}
  </select>
</div>
              <div style={{ ...styles.field, flex: 2 }}>
                <label style={styles.label}>Notes (optional)</label>
                <input
                  style={styles.input}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.totalPreview}>Total: ₹{total.toFixed(2)}</span>
          <div style={styles.footerBtns}>
            <button style={styles.cancelBtn} onClick={onClose} disabled={saving}>Cancel</button>
            <button style={styles.saveBtn} onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Update Invoice' : 'Create Invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TotalRow({ label, value, bold, neg }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
      <span style={{ fontSize: 13, color: bold ? 'var(--gray-900)' : 'var(--gray-500)', fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: neg ? 'var(--green-600)' : bold ? 'var(--gray-900)' : 'var(--gray-700)' }}>
        {neg ? '−' : ''}₹{Math.abs(value).toFixed(2)}
      </span>
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
  modal: {
    background: '#fff',
    borderRadius: 14,
    width: '100%', maxWidth: 780,
    maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden'
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 24px 16px',
    borderBottom: '1px solid var(--gray-100)'
  },
  title: { fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' },
  closeBtn: {
    background: 'none', border: 'none',
    color: 'var(--gray-400)', padding: 6, borderRadius: 6,
    display: 'flex', alignItems: 'center'
  },
  body: { flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 },
  footer: {
    padding: '14px 24px',
    borderTop: '1px solid var(--gray-100)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'var(--gray-50)'
  },
  footerBtns: { display: 'flex', gap: 10 },
  totalPreview: { fontSize: 16, fontWeight: 700, color: 'var(--blue-700)', fontFamily: 'var(--font-head)' },
  section: { display: 'flex', flexDirection: 'column', gap: 12 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.06em' },
  sectionTitleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  row: { display: 'flex', gap: 14 },
  field: { flex: 1, display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--gray-600)' },
  input: {
    padding: '8px 10px',
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--gray-200)',
    borderRadius: 8, fontSize: 13, color: 'var(--gray-800)',
    outline: 'none', width: '100%',
    transition: 'border-color var(--transition)'
  },
  inputError: { borderColor: 'var(--red-500)' },
  errText: { fontSize: 11, color: 'var(--red-500)', marginTop: 2 },
  errorBanner: {
    background: 'var(--red-50)', border: '1px solid var(--red-500)',
    borderRadius: 8, padding: '10px 14px',
    fontSize: 13, color: 'var(--red-600)'
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { padding: '8px 8px', background: 'var(--gray-50)', fontWeight: 600, color: 'var(--gray-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', border: '1px solid var(--gray-100)', textAlign: 'left' },
  td: { padding: '6px 6px', border: '1px solid var(--gray-100)', verticalAlign: 'middle' },
  tableInput: {
    width: '100%', padding: '6px 8px',
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--gray-200)',
    borderRadius: 6, fontSize: 13, color: 'var(--gray-800)',
    outline: 'none', background: '#fff',
    cursor: 'text',
    transition: 'border-color var(--transition)'
  },
  removeBtn: {
    background: 'none', border: 'none',
    color: 'var(--red-500)', padding: 4, borderRadius: 4,
    display: 'flex', alignItems: 'center', cursor: 'pointer'
  },
  addItemBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    background: 'var(--blue-50)', color: 'var(--blue-700)',
    border: 'none', borderRadius: 7,
    padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer'
  },
  totalsRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 },
  gstDiscRow: { display: 'flex', gap: 14, alignItems: 'flex-end' },
  totalsBox: { minWidth: 240, background: 'var(--gray-50)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 },
  totalDivider: { borderTop: '1.5px solid var(--gray-200)', margin: '6px 0' },
  cancelBtn: {
    padding: '9px 20px', borderRadius: 8, borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--gray-200)',
    background: '#fff', color: 'var(--gray-600)', fontSize: 13, fontWeight: 600
  },
  saveBtn: {
    padding: '9px 22px', borderRadius: 8, border: 'none',
    background: 'var(--blue-600)', color: '#fff', fontSize: 13, fontWeight: 600
  },
}