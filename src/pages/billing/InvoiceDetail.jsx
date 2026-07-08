import { useEffect, useRef, useState } from 'react'
import { X, Printer, IndianRupee, Trash2, Mail } from 'lucide-react'

const API = 'http://localhost:5000/api/billing'
const getToken = () => localStorage.getItem('vtcrm_token')

const STATUS_COLORS = {
  'Draft':          { bg: 'var(--gray-100)',  color: 'var(--gray-600)' },
  'Sent':           { bg: 'var(--blue-50)',   color: 'var(--blue-700)' },
  'Partially Paid': { bg: 'var(--amber-50)',  color: '#b45309' },
  'Paid':           { bg: 'var(--green-50)',  color: 'var(--green-600)' },
  'Cancelled':      { bg: 'var(--red-50)',    color: 'var(--red-600)' },
}

export default function InvoiceDetail({ invoice, onClose, onPayment, onEdit, onDelete }) {
  const printRef = useRef()
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailInput, setEmailInput]         = useState(invoice.customer_email || '')
  const [sending, setSending]               = useState(false)
  const [emailMsg, setEmailMsg]             = useState('')

  const handleSendEmail = async () => {
    if (!emailInput.trim()) { setEmailMsg('Please enter a valid email address'); return }
    setSending(true)
    setEmailMsg('')
    try {
      const res = await fetch(`${API}/${invoice.id}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ customer_email: emailInput.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setEmailMsg(`✅ Invoice sent to ${emailInput}`)
        setTimeout(() => setShowEmailModal(false), 2000)
      } else {
        setEmailMsg(`❌ ${data.error || 'Failed to send email'}`)
      }
    } catch (e) {
      setEmailMsg('❌ Network error — check backend connection')
    } finally {
      setSending(false)
    }
  }

  const handlePrint = () => {
    const items    = invoice.items    || []
    const payments = invoice.payments || []
    const due      = parseFloat(invoice.due_amount)   || 0
    const paid     = parseFloat(invoice.paid_amount)  || 0
    const total    = parseFloat(invoice.total_amount) || 0
    const subtotal = parseFloat(invoice.subtotal)     || 0
    const discount = parseFloat(invoice.discount)     || 0
    const gstAmt   = parseFloat(invoice.gst_amount)   || 0
    const gstRate  = parseFloat(invoice.gst_rate)     || 0

    const dateStr = new Date(invoice.created_at).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
    const fmt = (n) =>
      `&#8377;${parseFloat(n).toLocaleString('en-IN', {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      })}`

    const statusColors = {
      'Draft':          { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
      'Sent':           { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
      'Partially Paid': { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
      'Paid':           { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
      'Cancelled':      { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
    }
    const sc = statusColors[invoice.status] || statusColors['Draft']

    // ── Item rows ────────────────────────────────────────────────────────────
    const itemRows = items.map((item, i) => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding:11px 14px;border-bottom:1px solid #e2e8f0;
                   font-size:13px;color:#334155;width:50%;">${item.description}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #e2e8f0;
                   font-size:13px;text-align:center;color:#475569;width:10%;">${item.quantity}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #e2e8f0;
                   font-size:13px;text-align:right;color:#475569;width:20%;">${fmt(item.unit_price)}</td>
        <td style="padding:11px 14px;border-bottom:1px solid #e2e8f0;
                   font-size:13px;text-align:right;font-weight:600;color:#1e293b;width:20%;">${fmt(item.amount)}</td>
      </tr>`).join('')

    // ── Totals rows (table-based, no flexbox) ────────────────────────────────
    const subtotalRow = `
      <tr style="background:#f8fafc;">
        <td style="padding:9px 16px;font-size:13px;color:#64748b;width:60%;">Subtotal</td>
        <td style="padding:9px 16px;font-size:13px;font-weight:600;color:#334155;
                   text-align:right;width:40%;">${fmt(subtotal)}</td>
      </tr>`

    const discountRow = discount > 0 ? `
      <tr style="background:#ffffff;">
        <td style="padding:9px 16px;font-size:13px;color:#64748b;">Discount</td>
        <td style="padding:9px 16px;font-size:13px;font-weight:600;color:#16a34a;
                   text-align:right;">&minus; ${fmt(discount)}</td>
      </tr>` : ''

    const gstRow = gstRate > 0 ? `
      <tr style="background:#f8fafc;">
        <td style="padding:9px 16px;font-size:13px;color:#64748b;">GST (${gstRate}%)</td>
        <td style="padding:9px 16px;font-size:13px;font-weight:600;color:#334155;
                   text-align:right;">${fmt(gstAmt)}</td>
      </tr>` : ''

    const totalRow = `
      <tr style="background:linear-gradient(90deg,#1e40af,#2563eb);">
        <td style="padding:13px 16px;font-size:14px;font-weight:700;
                   color:#bfdbfe;text-transform:uppercase;letter-spacing:.06em;">Total</td>
        <td style="padding:13px 16px;font-size:20px;font-weight:900;
                   color:#ffffff;text-align:right;">${fmt(total)}</td>
      </tr>`

    const paidRow = paid > 0 ? `
      <tr style="background:#f0fdf4;">
        <td style="padding:9px 16px;font-size:13px;font-weight:600;
                   color:#15803d;border-top:1.5px solid #d1fae5;">Paid</td>
        <td style="padding:9px 16px;font-size:14px;font-weight:700;
                   color:#15803d;text-align:right;border-top:1.5px solid #d1fae5;">${fmt(paid)}</td>
      </tr>` : ''

    const dueRow = due > 0 ? `
      <tr style="background:#fef2f2;">
        <td style="padding:9px 16px;font-size:13px;font-weight:600;
                   color:#b91c1c;border-top:1.5px solid #fecaca;">Balance Due</td>
        <td style="padding:9px 16px;font-size:16px;font-weight:800;
                   color:#b91c1c;text-align:right;border-top:1.5px solid #fecaca;">${fmt(due)}</td>
      </tr>` : ''

    // ── Payment history ──────────────────────────────────────────────────────
    const paymentRows = payments.map(p => `
      <tr>
        <td style="padding:9px 14px;font-size:12px;color:#334155;
                   border-bottom:1px solid #d1fae5;">
          ${new Date(p.payment_date).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
        </td>
        <td style="padding:9px 14px;font-size:12px;color:#334155;
                   border-bottom:1px solid #d1fae5;">${p.payment_mode}</td>
        <td style="padding:9px 14px;font-size:12px;color:#64748b;
                   border-bottom:1px solid #d1fae5;">${p.notes || '—'}</td>
        <td style="padding:9px 14px;font-size:12px;text-align:right;font-weight:700;
                   color:#15803d;border-bottom:1px solid #d1fae5;">${fmt(p.amount)}</td>
      </tr>`).join('')

    const paymentsSection = payments.length > 0 ? `
      <div style="margin-top:28px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                    letter-spacing:.08em;color:#64748b;margin-bottom:10px;">
          Payment History
        </div>
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border-collapse:collapse;border:1px solid #d1fae5;border-radius:10px;
                      overflow:hidden;">
          <thead>
            <tr style="background:#dcfce7;">
              <th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;
                         text-transform:uppercase;letter-spacing:.05em;color:#15803d;width:20%;">Date</th>
              <th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;
                         text-transform:uppercase;letter-spacing:.05em;color:#15803d;width:18%;">Mode</th>
              <th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;
                         text-transform:uppercase;letter-spacing:.05em;color:#15803d;width:42%;">Reference</th>
              <th style="padding:9px 14px;text-align:right;font-size:11px;font-weight:700;
                         text-transform:uppercase;letter-spacing:.05em;color:#15803d;width:20%;">Amount</th>
            </tr>
          </thead>
          <tbody>${paymentRows}</tbody>
        </table>
      </div>` : ''

    // ── Full HTML page ────────────────────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #f1f5f9;
      color: #1e293b;
    }
    .page {
      background: #fff;
      width: 794px;
      min-height: 1123px;
      margin: 0 auto;
      padding: 0;
    }
    .content {
      padding: 36px 40px 40px;
    }
    table { border-collapse: collapse; }
    @media print {
      body { background: #fff; }
      .page { width: 100%; min-height: 100vh; box-shadow: none; margin: 0; }
      .content { padding: 28px 32px 32px; }
      @page { margin: 0; size: A4; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Gradient header — full width -->
  <div style="background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 60%,#3b82f6 100%);
              padding:30px 40px 26px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:top;">
          <div style="font-size:26px;font-weight:900;color:#fff;
                      letter-spacing:-.3px;margin-bottom:4px;">
            Virtual Tech Services
          </div>
          <div style="font-size:12px;color:#bfdbfe;text-transform:uppercase;
                      letter-spacing:.06em;">
            CRM Billing System
          </div>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <div style="font-size:12px;color:#bfdbfe;text-transform:uppercase;
                      letter-spacing:.08em;margin-bottom:3px;">Invoice</div>
          <div style="font-size:26px;font-weight:900;color:#fff;
                      letter-spacing:-.5px;">${invoice.invoice_number}</div>
          <div style="font-size:12px;color:#bfdbfe;margin-top:4px;">${dateStr}</div>
          <div style="margin-top:8px;">
            <span style="display:inline-block;padding:4px 14px;border-radius:99px;
                         font-size:12px;font-weight:700;background:${sc.bg};
                         color:${sc.color};border:1.5px solid ${sc.border};
                         letter-spacing:.03em;">
              ${invoice.status}
            </span>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Rainbow accent bar -->
  <div style="height:4px;background:linear-gradient(90deg,#f59e0b,#ef4444,#8b5cf6,#06b6d4);"></div>

  <div class="content">

    <!-- Bill To / Notes -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1.5px solid #e2e8f0;border-radius:12px;
                  overflow:hidden;margin-bottom:28px;">
      <tr>
        <td style="padding:18px 22px;background:#f8fafc;
                   border-right:1.5px solid #e2e8f0;width:45%;
                   vertical-align:top;">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;
                      letter-spacing:.1em;color:#94a3b8;margin-bottom:6px;">Bill To</div>
          <div style="font-size:18px;font-weight:800;color:#1e293b;
                      margin-bottom:4px;">${invoice.customer_name}</div>
          <div style="font-size:13px;color:#64748b;">${invoice.phone}</div>
          ${invoice.customer_email
            ? `<div style="font-size:12px;color:#94a3b8;margin-top:3px;">${invoice.customer_email}</div>`
            : ''}
        </td>
        <td style="padding:18px 22px;background:#fff;vertical-align:top;">
          ${invoice.notes
            ? `<div style="font-size:10px;font-weight:800;text-transform:uppercase;
                           letter-spacing:.1em;color:#94a3b8;margin-bottom:6px;">Notes</div>
               <div style="font-size:13px;color:#475569;line-height:1.6;">${invoice.notes}</div>`
            : ''}
        </td>
      </tr>
    </table>

    <!-- Items table — full width -->
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;
                letter-spacing:.08em;color:#64748b;margin-bottom:10px;">
      Services &amp; Items
    </div>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1.5px solid #e2e8f0;border-radius:10px;
                  overflow:hidden;margin-bottom:24px;">
      <thead>
        <tr style="background:linear-gradient(90deg,#1e40af,#2563eb);">
          <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;
                     text-transform:uppercase;letter-spacing:.06em;color:#fff;width:50%;">
            Description
          </th>
          <th style="padding:12px 14px;text-align:center;font-size:11px;font-weight:700;
                     text-transform:uppercase;letter-spacing:.06em;color:#fff;width:10%;">
            Qty
          </th>
          <th style="padding:12px 14px;text-align:right;font-size:11px;font-weight:700;
                     text-transform:uppercase;letter-spacing:.06em;color:#fff;width:20%;">
            Unit Price
          </th>
          <th style="padding:12px 14px;text-align:right;font-size:11px;font-weight:700;
                     text-transform:uppercase;letter-spacing:.06em;color:#fff;width:20%;">
            Amount
          </th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- Totals — right-aligned block using table layout -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="width:45%;vertical-align:top;"></td>
        <td style="width:55%;vertical-align:top;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="border:1.5px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <tbody>
              ${subtotalRow}
              ${discountRow}
              ${gstRow}
              ${totalRow}
              ${paidRow}
              ${dueRow}
            </tbody>
          </table>
        </td>
      </tr>
    </table>

    ${paymentsSection}

    <!-- Footer -->
    <div style="margin-top:36px;padding-top:18px;border-top:2px dashed #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;width:33%;">
            <div style="font-size:14px;font-weight:700;color:#2563eb;">
              Virtual Tech Services
            </div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">
              CRM Billing System
            </div>
          </td>
          <td style="text-align:center;vertical-align:middle;width:34%;">
            <div style="font-size:13px;font-weight:600;color:#334155;">
              Thank you for your business! 🙏
            </div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">
              Generated by Virtual Tech CRM
            </div>
          </td>
          <td style="text-align:right;vertical-align:middle;width:33%;">
            <div style="font-size:10px;color:#cbd5e1;text-transform:uppercase;
                        letter-spacing:.06em;">
              Invoice No.
            </div>
            <div style="font-size:13px;font-weight:700;color:#334155;">
              ${invoice.invoice_number}
            </div>
          </td>
        </tr>
      </table>
    </div>

  </div><!-- /content -->
</div><!-- /page -->
</body>
</html>`

    const blob    = new Blob([html], { type: 'text/html; charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    const win     = window.open(blobUrl, '_blank', 'width=900,height=1000')
    if (win) {
      win.addEventListener('load', () => {
        setTimeout(() => { win.print(); URL.revokeObjectURL(blobUrl) }, 300)
      })
    } else {
      URL.revokeObjectURL(blobUrl)
      alert('Popup was blocked. Please allow popups for this site.')
    }
  }

  const sc       = STATUS_COLORS[invoice.status] || STATUS_COLORS['Draft']
  const items    = invoice.items    || []
  const payments = invoice.payments || []
  const due      = parseFloat(invoice.due_amount) || 0

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.panel}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h2 style={styles.title}>{invoice.invoice_number}</h2>
            <span style={{ ...styles.badge, background: sc.bg, color: sc.color }}>{invoice.status}</span>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.actionBtn} onClick={handlePrint} title="Print / Save as PDF">
              <Printer size={15} /> Print / PDF
            </button>
            <button
              style={{ ...styles.actionBtn, ...styles.emailBtn }}
              onClick={() => setShowEmailModal(true)}
              title="Send invoice via email"
            >
              <Mail size={15} /> Send Email
            </button>
            <button
  style={{ ...styles.actionBtn, ...styles.editBtn }}
  onClick={() => onEdit(invoice)}
>
  Edit
</button>
            {due > 0 && invoice.status !== 'Cancelled' && (
              <button style={{ ...styles.actionBtn, ...styles.payBtn }} onClick={() => onPayment(invoice)}>
                <IndianRupee size={13} /> Record Payment
              </button>
            )}
            {onDelete && (
              <button style={{ ...styles.actionBtn, ...styles.deleteBtn }} onClick={e => onDelete(invoice, e)} title="Delete invoice">
                <Trash2 size={14} /> Delete
              </button>
            )}
            <button style={styles.closeBtn} onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={styles.body}>
          <div ref={printRef}>
            <div className="inv-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--blue-700)', fontFamily: 'var(--font-head)' }}>Virtual Tech Services</div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>CRM Billing System</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)', fontFamily: 'var(--font-head)' }}>{invoice.invoice_number}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                  Date: {new Date(invoice.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                <span style={{ display: 'inline-block', marginTop: 6, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>{invoice.status}</span>
              </div>
            </div>

            <div style={styles.customerBox}>
              <div>
                <div style={styles.sectionLabel}>Bill To</div>
                <div style={styles.customerName}>{invoice.customer_name}</div>
                <div style={styles.customerPhone}>{invoice.phone}</div>
                {invoice.customer_email && (
                  <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>{invoice.customer_email}</div>
                )}
              </div>
              {invoice.notes && (
                <div>
                  <div style={styles.sectionLabel}>Notes</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-600)' }}>{invoice.notes}</div>
                </div>
              )}
            </div>

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: '50%' }}>Description</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Qty</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Unit Price</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td style={styles.td}>{item.description}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{item.quantity}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>₹{parseFloat(item.unit_price).toFixed(2)}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 500 }}>₹{parseFloat(item.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={styles.totalsSection}>
              <div style={styles.totalsBox}>
                <TotalRow label="Subtotal" value={invoice.subtotal} />
                {parseFloat(invoice.discount) > 0 && <TotalRow label="Discount" value={invoice.discount} neg />}
                {parseFloat(invoice.gst_rate) > 0 && <TotalRow label={`GST (${invoice.gst_rate}%)`} value={invoice.gst_amount} />}
                <div style={styles.divider} />
                <TotalRow label="Total" value={invoice.total_amount} bold />
                {parseFloat(invoice.paid_amount) > 0 && <TotalRow label="Paid" value={invoice.paid_amount} green />}
                {due > 0 && <TotalRow label="Due" value={due} red />}
              </div>
            </div>

            {payments.length > 0 && (
              <div style={styles.paymentsSection}>
                <div style={styles.sectionLabel}>Payment History</div>
                <div style={styles.paymentList}>
                  {payments.map((p, i) => (
                    <div key={i} style={styles.paymentRow}>
                      <div>
                        <span style={styles.payMode}>{p.payment_mode}</span>
                        {p.notes && <span style={styles.payNote}> · {p.notes}</span>}
                      </div>
                      <div style={styles.payRight}>
                        <span style={styles.payDate}>{new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span style={styles.payAmount}>₹{parseFloat(p.amount).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 32, textAlign: 'center', fontSize: 11, color: 'var(--gray-400)', borderTop: '1px solid var(--gray-100)', paddingTop: 14 }}>
              Thank you for your business · Virtual Tech Services
            </div>
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div style={styles.emailOverlay} onClick={e => e.target === e.currentTarget && setShowEmailModal(false)}>
          <div style={styles.emailModal}>
            <div style={styles.emailHeader}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>
                <Mail size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Send Invoice via Email
              </h3>
              <button style={styles.closeBtn} onClick={() => setShowEmailModal(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
                Invoice <strong>{invoice.invoice_number}</strong> will be sent as PDF to the customer and admin.
              </p>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', display: 'block', marginBottom: 6 }}>
                Customer Email <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="email"
                placeholder="customer@example.com"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                style={styles.emailInput}
                onKeyDown={e => e.key === 'Enter' && handleSendEmail()}
              />
              {emailMsg && (
                <p style={{ fontSize: 13, marginTop: 10, color: emailMsg.startsWith('✅') ? 'var(--green-600)' : 'var(--red-600)' }}>
                  {emailMsg}
                </p>
              )}
            </div>
            <div style={styles.emailFooter}>
              <button style={styles.actionBtn} onClick={() => setShowEmailModal(false)} disabled={sending}>Cancel</button>
              <button
                style={{ ...styles.actionBtn, ...styles.emailBtn, opacity: sending ? .6 : 1 }}
                onClick={handleSendEmail}
                disabled={sending}
              >
                <Mail size={14} /> {sending ? 'Sending...' : 'Send Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TotalRow({ label, value, bold, neg, green, red }) {
  const color = red ? 'var(--red-600)' : green ? 'var(--green-600)' : bold ? 'var(--gray-900)' : 'var(--gray-600)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ fontSize: 13, color: bold ? 'var(--gray-900)' : 'var(--gray-500)', fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color }}>
        {neg ? '−' : ''}₹{Math.abs(parseFloat(value)).toFixed(2)}
      </span>
    </div>
  )
}

const styles = {
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  panel:       { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 700, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid var(--gray-100)', gap: 10, flexWrap: 'wrap' },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: 10 },
  title:       { fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 700, color: 'var(--gray-900)' },
  badge:       { padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  actionBtn:   { display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--gray-200)', borderRadius: 8, background: '#fff', color: 'var(--gray-600)', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  emailBtn:    { background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' },
  editBtn:     { background: 'var(--blue-50)', borderColor: 'var(--blue-200)', color: 'var(--blue-700)' },
  payBtn:      { background: 'var(--green-600)', border: 'none', color: '#fff' },
  deleteBtn:   { background: '#fef2f2', borderColor: '#fecaca', color: 'var(--red-600)' },
  closeBtn:    { background: 'none', border: 'none', color: 'var(--gray-400)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', cursor: 'pointer' },
  body:        { flex: 1, overflowY: 'auto', padding: '24px 28px' },
  sectionLabel:  { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--gray-400)', marginBottom: 5 },
  customerBox:   { display: 'flex', gap: 40, background: 'var(--gray-50)', borderRadius: 10, padding: '16px 18px', marginBottom: 22 },
  customerName:  { fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' },
  customerPhone: { fontSize: 13, color: 'var(--gray-500)', marginTop: 2 },
  table:         { width: '100%', borderCollapse: 'collapse', marginBottom: 20 },
  th:            { background: 'var(--gray-50)', padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--gray-500)', border: '1px solid var(--gray-100)' },
  td:            { padding: '10px 12px', borderBottom: '1px solid var(--gray-100)', fontSize: 13, color: 'var(--gray-700)' },
  totalsSection: { display: 'flex', justifyContent: 'flex-end', marginBottom: 24 },
  totalsBox:     { minWidth: 250, display: 'flex', flexDirection: 'column', gap: 3 },
  divider:       { borderTop: '1.5px solid var(--gray-200)', margin: '8px 0' },
  paymentsSection: { marginTop: 10 },
  paymentList:   { display: 'flex', flexDirection: 'column', gap: 6 },
  paymentRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--green-50)', borderRadius: 8 },
  payMode:       { fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' },
  payNote:       { fontSize: 12, color: 'var(--gray-400)' },
  payRight:      { display: 'flex', alignItems: 'center', gap: 14 },
  payDate:       { fontSize: 12, color: 'var(--gray-400)' },
  payAmount:     { fontSize: 14, fontWeight: 700, color: 'var(--green-600)' },
  // Email modal
  emailOverlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 },
  emailModal:    { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,.2)' },
  emailHeader:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid var(--gray-100)' },
  emailFooter:   { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid var(--gray-100)' },
  emailInput:    { width: '100%', padding: '9px 12px', border: '1.5px solid var(--gray-200)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' },
}