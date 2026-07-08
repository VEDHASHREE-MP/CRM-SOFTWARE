import { useState } from 'react'
import api from '../../api/axios'
import { X, IndianRupee } from 'lucide-react'

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque']

export default function PaymentModal({ invoice, onClose, onSaved }) {
  const [form, setForm] = useState({
    amount: '',
    payment_mode: [],
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const togglePaymentMode = (mode) => {
    setForm(prev => {
      const exists = prev.payment_mode.includes(mode)

      return {
        ...prev,
        payment_mode: exists
          ? prev.payment_mode.filter(m => m !== mode)
          : [...prev.payment_mode, mode]
      }
    })
  }

  const handleSubmit = async () => {
    const amount = parseFloat(form.amount)

    if (!amount || amount <= 0) {
      setError('Enter a valid amount')
      return
    }

    if (amount > invoice.due_amount + 0.01) {
      setError(`Amount exceeds due amount ₹${invoice.due_amount.toFixed(2)}`)
      return
    }

    if (form.payment_mode.length === 0) {
      setError('Select at least one payment mode')
      return
    }

    setSaving(true)

    try {
      const res = await api.post(`/billing/${invoice.id}/payments`, {
        ...form,
        amount: parseFloat(form.amount),
        payment_mode: form.payment_mode.join(', ')
      })

      onSaved(res.data.invoice)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record payment')
    } finally {
      setSaving(false)
    }
  }

  const due = parseFloat(invoice.due_amount) || 0

  return (
    <div
      style={styles.overlay}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Record Payment</h2>
            <p style={styles.subtitle}>
              {invoice.invoice_number} · {invoice.customer_name}
            </p>
          </div>

          <button style={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={styles.body}>
          <div style={styles.dueBox}>
            <div style={styles.dueItem}>
              <span style={styles.dueLabel}>Invoice Total</span>
              <span style={styles.dueVal}>
                ₹{parseFloat(invoice.total_amount).toFixed(2)}
              </span>
            </div>

            <div style={styles.dueItem}>
              <span style={styles.dueLabel}>Already Paid</span>
              <span
                style={{
                  ...styles.dueVal,
                  color: 'var(--green-600)'
                }}
              >
                ₹{parseFloat(invoice.paid_amount).toFixed(2)}
              </span>
            </div>

            <div
              style={{
                ...styles.dueItem,
                borderTop: '1.5px solid var(--gray-200)',
                paddingTop: 10,
                marginTop: 4
              }}
            >
              <span
                style={{
                  ...styles.dueLabel,
                  fontWeight: 700,
                  color: 'var(--gray-800)'
                }}
              >
                Due Amount
              </span>

              <span
                style={{
                  ...styles.dueVal,
                  color: 'var(--red-600)',
                  fontSize: 18,
                  fontWeight: 700
                }}
              >
                ₹{due.toFixed(2)}
              </span>
            </div>
          </div>

          {error && (
            <div style={styles.errorBanner}>
              {error}
            </div>
          )}

          <div style={styles.field}>
            <label style={styles.label}>
              Payment Amount (₹) *
            </label>

            <div style={styles.amountRow}>
              <div style={styles.amountInputWrap}>
                <IndianRupee
                  size={14}
                  style={{
                    color: 'var(--gray-400)',
                    flexShrink: 0
                  }}
                />

                <input
                  style={styles.amountInput}
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={due}
                  value={form.amount}
                  onChange={e => {
                    setError('')
                    setForm(f => ({
                      ...f,
                      amount: e.target.value
                    }))
                  }}
                  placeholder="0.00"
                  autoFocus
                />
              </div>

              <button
                style={styles.fullBtn}
                onClick={() =>
                  setForm(f => ({
                    ...f,
                    amount: due.toFixed(2)
                  }))
                }
              >
                Full Due
              </button>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>
              Payment Mode *
            </label>

            <div style={styles.modeGrid}>
              {PAYMENT_MODES.map(mode => (
                <button
                  key={mode}
                  type="button"
                  style={{
                    ...styles.modeBtn,
                    ...(form.payment_mode.includes(mode)
                      ? styles.modeBtnActive
                      : {})
                  }}
                  onClick={() => togglePaymentMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>
              Payment Date *
            </label>

            <input
              style={styles.input}
              type="date"
              value={form.payment_date}
              onChange={e =>
                setForm(f => ({
                  ...f,
                  payment_date: e.target.value
                }))
              }
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>
              Notes (optional)
            </label>

            <input
              style={styles.input}
              value={form.notes}
              onChange={e =>
                setForm(f => ({
                  ...f,
                  notes: e.target.value
                }))
              }
              placeholder="e.g. UPI ref: 1234567890"
            />
          </div>
        </div>

        <div style={styles.footer}>
          <button
            style={styles.cancelBtn}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            style={styles.saveBtn}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: 20
  },

  modal: {
    background: '#fff',
    borderRadius: 14,
    width: '100%',
    maxWidth: 480,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-lg)'
  },

  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '18px 22px 14px',
    borderBottom: '1px solid var(--gray-100)'
  },

  title: {
    fontFamily: 'var(--font-head)',
    fontSize: 17,
    fontWeight: 700,
    color: 'var(--gray-900)'
  },

  subtitle: {
    fontSize: 12,
    color: 'var(--gray-400)',
    marginTop: 2
  },

  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--gray-400)',
    padding: 4,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center'
  },

  body: {
    padding: '20px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 18
  },

  footer: {
    padding: '14px 22px',
    borderTop: '1px solid var(--gray-100)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10
  },

  dueBox: {
    background: 'var(--gray-50)',
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },

  dueItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  dueLabel: {
    fontSize: 13,
    color: 'var(--gray-500)'
  },

  dueVal: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--gray-800)'
  },

  errorBanner: {
    background: 'var(--red-50)',
    border: '1px solid var(--red-500)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: 'var(--red-600)'
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },

  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--gray-600)'
  },

  input: {
    padding: '9px 12px',
    border: '1.5px solid var(--gray-200)',
    borderRadius: 8,
    fontSize: 13,
    color: 'var(--gray-800)',
    outline: 'none'
  },

  amountRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center'
  },

  amountInputWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 12px',
    border: '1.5px solid var(--blue-400)',
    borderRadius: 8,
    background: 'var(--blue-50)'
  },

  amountInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--gray-900)',
    outline: 'none'
  },

  fullBtn: {
    padding: '9px 14px',
    background: 'var(--gray-100)',
    border: '1.5px solid var(--gray-200)',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--gray-600)',
    cursor: 'pointer'
  },

  modeGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8
  },

  modeBtn: {
    padding: '8px 14px',
    border: '1.5px solid var(--gray-200)',
    borderRadius: 8,
    background: '#fff',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--gray-600)',
    cursor: 'pointer'
  },

  modeBtnActive: {
    background: 'var(--blue-600)',
    color: '#fff',
    borderColor: 'var(--blue-600)',
    fontWeight: 600
  },

  cancelBtn: {
    padding: '9px 20px',
    borderRadius: 8,
    border: '1.5px solid var(--gray-200)',
    background: '#fff',
    color: 'var(--gray-600)',
    fontSize: 13,
    fontWeight: 600
  },

  saveBtn: {
    padding: '9px 22px',
    borderRadius: 8,
    border: 'none',
    background: 'var(--green-600)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600
  }
}