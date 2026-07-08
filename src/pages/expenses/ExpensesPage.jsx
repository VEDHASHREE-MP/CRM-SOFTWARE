import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid
} from 'recharts'
import { Plus, Pencil, Trash2, RefreshCw, TrendingDown, TrendingUp, Wallet, ReceiptText } from 'lucide-react'
import { useToast } from '../../context/ToastContext'

const API      = 'http://localhost:5000/api/expenses'
const getToken = () => localStorage.getItem('vtcrm_token')

const apiFetch = async (path, opts = {}) => {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

const fmt = (n) =>
  `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const today      = new Date().toISOString().slice(0, 10)
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString().slice(0, 10)

const PIE_COLORS = ['#2563eb','#16a34a','#d97706','#7c3aed','#0d9488','#db2777','#dc2626','#64748b','#ea580c','#0891b2']

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="card" style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{
        width: 46, height: 46, borderRadius: 12,
        background: color + '18', color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <Icon size={22} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 3 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color, fontWeight: 600, marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, onSave, loading, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid var(--gray-100)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--gray-900)' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--gray-400)', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
        <div style={{
          padding: '14px 24px', borderTop: '1px solid var(--gray-100)',
          display: 'flex', justifyContent: 'flex-end', gap: 10
        }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={loading}>
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Expense Form Modal ────────────────────────────────────────────────────────
function ExpenseModal({ expense, categories, onClose, onSaved }) {
  const { addToast } = useToast()
  const [form, setForm] = useState({
    title:        expense?.title        || '',
    category:     expense?.category     || '',
    amount:       expense?.amount       || '',
    expense_date: expense?.expense_date || today,
    notes:        expense?.notes        || '',
  })
  const [customCat, setCustomCat] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    const cat = form.category === '__custom__' ? customCat.trim() : form.category
    if (!form.title || !cat || !form.amount || !form.expense_date) {
      addToast('Please fill all required fields', 'error', '⚠️')
      return
    }
    setLoading(true)
    try {
      const body = { ...form, category: cat, amount: parseFloat(form.amount) }
      if (expense?.id) {
        await apiFetch(`/${expense.id}`, { method: 'PUT', body: JSON.stringify(body) })
        addToast('Expense updated', 'success', '✅')
      } else {
        await apiFetch('/', { method: 'POST', body: JSON.stringify(body) })
        addToast('Expense added', 'success', '✅')
      }
      onSaved()
    } catch (e) {
      addToast(e.message, 'error', '❌')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={expense?.id ? 'Edit Expense' : 'Add Expense'} onClose={onClose} onSave={handleSave} loading={loading}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="form-label">Title *</label>
          <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Office rent for June" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="form-label">Category *</label>
            <select className="form-input" value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="">Select…</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__custom__">+ Add custom…</option>
            </select>
          </div>
          <div>
            <label className="form-label">Amount (₹) *</label>
            <input className="form-input" type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
          </div>
        </div>
        {form.category === '__custom__' && (
          <div>
            <label className="form-label">Custom Category *</label>
            <input className="form-input" value={customCat} onChange={e => setCustomCat(e.target.value)} placeholder="Enter category name" />
          </div>
        )}
        <div>
          <label className="form-label">Date *</label>
          <input className="form-input" type="date" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} />
        </div>
        <div>
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional details…" style={{ resize: 'vertical' }} />
        </div>
      </div>
    </Modal>
  )
}

// ── Return Form Modal ─────────────────────────────────────────────────────────
function ReturnModal({ ret, onClose, onSaved }) {
  const { addToast } = useToast()
  const [form, setForm] = useState({
    title:       ret?.title       || '',
    amount:      ret?.amount      || '',
    return_date: ret?.return_date || today,
    notes:       ret?.notes       || '',
  })
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.title || !form.amount || !form.return_date) {
      addToast('Please fill all required fields', 'error', '⚠️')
      return
    }
    setLoading(true)
    try {
      const body = { ...form, amount: parseFloat(form.amount) }
      if (ret?.id) {
        await apiFetch(`/returns/${ret.id}`, { method: 'PUT', body: JSON.stringify(body) })
        addToast('Return updated', 'success', '✅')
      } else {
        await apiFetch('/returns/', { method: 'POST', body: JSON.stringify(body) })
        addToast('Return recorded', 'success', '✅')
      }
      onSaved()
    } catch (e) {
      addToast(e.message, 'error', '❌')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={ret?.id ? 'Edit Return' : 'Record Return'} onClose={onClose} onSave={handleSave} loading={loading}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="form-label">Title *</label>
          <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Customer refund — Invoice #42" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="form-label">Amount (₹) *</label>
            <input className="form-input" type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="form-label">Date *</label>
            <input className="form-input" type="date" value={form.return_date} onChange={e => set('return_date', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional details…" style={{ resize: 'vertical' }} />
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ExpensesPage() {
  const { addToast } = useToast()

  const [tab,        setTab]        = useState('overview')
  const [dateFrom,   setDateFrom]   = useState(monthStart)
  const [dateTo,     setDateTo]     = useState(today)
  const [summary,    setSummary]    = useState(null)
  const [expenses,   setExpenses]   = useState([])
  const [returns,    setReturns]    = useState([])
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)

  const [expModal,   setExpModal]   = useState(null)  // null | {} | expense obj
  const [retModal,   setRetModal]   = useState(null)

  const dateParams = () => {
    const p = new URLSearchParams()
    if (dateFrom) p.set('date_from', dateFrom)
    if (dateTo)   p.set('date_to',   dateTo)
    return p.toString()
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const qs = dateParams()
      const [sum, exps, rets, cats] = await Promise.all([
        apiFetch(`/summary?${qs}`),
        apiFetch(`/?${qs}`),
        apiFetch(`/returns/?${qs}`),
        apiFetch('/categories'),
      ])
      setSummary(sum)
      setExpenses(exps)
      setReturns(rets)
      setCategories(cats)
    } catch (e) {
      addToast(e.message, 'error', '❌ Error')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => { fetchAll() }, [fetchAll])

  const deleteExpense = async (id) => {
    if (!confirm('Delete this expense?')) return
    try {
      await apiFetch(`/${id}`, { method: 'DELETE' })
      addToast('Expense deleted', 'success', '✅')
      fetchAll()
    } catch (e) { addToast(e.message, 'error', '❌') }
  }

  const deleteReturn = async (id) => {
    if (!confirm('Delete this return?')) return
    try {
      await apiFetch(`/returns/${id}`, { method: 'DELETE' })
      addToast('Return deleted', 'success', '✅')
      fetchAll()
    } catch (e) { addToast(e.message, 'error', '❌') }
  }

  const netPositive = (summary?.net ?? 0) >= 0

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="page-title">Expenses & Returns</div>
          <div className="page-subtitle">Track outflows and money returned</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={fetchAll} disabled={loading}>
            <RefreshCw size={15} />
          </button>
          <button className="btn btn-primary" onClick={() => setExpModal({})}>
            <Plus size={15} /> Add Expense
          </button>
          <button className="btn btn-secondary" style={{ borderColor: '#16a34a', color: '#16a34a' }}
            onClick={() => setRetModal({})}>
            <Plus size={15} /> Record Return
          </button>
        </div>
      </div>

      {/* ── Date Range ── */}
      <div className="card" style={{ padding: '12px 20px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)' }}>Date Range</span>
        <input type="date" className="form-input" style={{ width: 150, fontSize: 13 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span style={{ color: 'var(--gray-400)', fontSize: 13 }}>to</span>
        <input type="date" className="form-input" style={{ width: 150, fontSize: 13 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {[
            { label: 'This Month', from: monthStart, to: today },
            { label: 'Last 3M',    from: nMonthsAgo(3), to: today },
            { label: 'This Year',  from: `${new Date().getFullYear()}-01-01`, to: today },
            { label: 'All Time',   from: '', to: '' },
          ].map(r => (
            <button key={r.label} className="btn btn-secondary btn-sm"
              style={{ fontSize: 12, ...(dateFrom === r.from && dateTo === r.to ? { background: 'var(--blue-600)', color: '#fff', borderColor: 'var(--blue-600)' } : {}) }}
              onClick={() => { setDateFrom(r.from); setDateTo(r.to) }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stat Cards ── */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
          <StatCard icon={TrendingDown}  label="Total Expenses" value={fmt(summary.total_expenses)} color="#dc2626"
            sub={`${summary.expense_count} entries`} />
          <StatCard icon={TrendingUp}    label="Total Returns"  value={fmt(summary.total_returns)}  color="#16a34a"
            sub={`${summary.return_count} entries`} />
          <StatCard icon={Wallet}        label="Net (Returns − Expenses)" value={fmt(Math.abs(summary.net))}
            color={netPositive ? '#16a34a' : '#dc2626'}
            sub={netPositive ? '▲ Net Positive' : '▼ Net Negative'} />
          <StatCard icon={ReceiptText}   label="Largest Category"
            value={summary.category_breakdown[0]?.category || '—'}
            color="#2563eb"
            sub={summary.category_breakdown[0] ? fmt(summary.category_breakdown[0].total) : ''} />
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--gray-100)', paddingBottom: 0 }}>
        {['overview', 'expenses', 'returns'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              background: 'none', border: 'none', padding: '8px 18px',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
              color: tab === t ? 'var(--blue-600)' : 'var(--gray-500)',
              borderBottom: tab === t ? '2px solid var(--blue-600)' : '2px solid transparent',
              marginBottom: -2, textTransform: 'capitalize'
            }}>
            {t === 'overview' ? '📊 Overview' : t === 'expenses' ? '📤 Expenses' : '📥 Returns'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          {/* ── OVERVIEW TAB ── */}
          {tab === 'overview' && summary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Monthly Trend */}
              <div className="card" style={{ padding: '18px 20px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 16 }}>
                  Monthly Expense vs Returns Trend
                </div>
                {summary.monthly_trend.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={summary.monthly_trend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v, n) => [fmt(v), n === 'expenses' ? 'Expenses' : 'Returns']} />
                      <Legend />
                      <Bar dataKey="expenses" name="Expenses" fill="#dc2626" radius={[4,4,0,0]} />
                      <Bar dataKey="returns"  name="Returns"  fill="#16a34a" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Expense by Category Pie */}
                <div className="card" style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 16 }}>
                    Expense Breakdown by Category
                  </div>
                  {summary.category_breakdown.length === 0 ? <EmptyChart /> : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart margin={{ top: 20, right: 30, bottom: 10, left: 30 }}>
                        <Pie
                          data={summary.category_breakdown.map(r => ({ name: r.category, value: r.total }))}
                          cx="50%" cy="48%" outerRadius={85} dataKey="value"
                          nameKey="name"
                          label={({ name, percent, x, y, textAnchor }) => (
                            <text x={x} y={y} textAnchor={textAnchor} fill="#374151" fontSize={12} fontWeight={500}>
                              {`${name} ${(percent * 100).toFixed(0)}%`}
                            </text>
                          )}
                          labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                        >
                          {summary.category_breakdown.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={v => [fmt(v), 'Amount']} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={10} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Net Profit Line */}
                <div className="card" style={{ padding: '18px 20px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 16 }}>
                    Net (Returns − Expenses) by Month
                  </div>
                  {summary.monthly_trend.length === 0 ? <EmptyChart /> : (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart
                        data={summary.monthly_trend.map(r => ({ ...r, net: r.returns - r.expenses }))}
                        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={v => [fmt(v), 'Net']} />
                        <Line type="monotone" dataKey="net" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }}
                          name="Net" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── EXPENSES TAB ── */}
          {tab === 'expenses' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                    {['Date', 'Title', 'Category', 'Amount', 'Notes', 'Added By', ''].map(h => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)', fontSize: 14 }}>No expenses recorded yet</td></tr>
                  ) : expenses.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                      <td style={tdStyle}>{e.expense_date}</td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--gray-800)' }}>{e.title}</td>
                      <td style={tdStyle}>
                        <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          {e.category}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: '#dc2626' }}>{fmt(e.amount)}</td>
                      <td style={{ ...tdStyle, color: 'var(--gray-400)', fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.notes || '—'}</td>
                      <td style={{ ...tdStyle, fontSize: 13, color: 'var(--gray-500)' }}>{e.created_by_name || '—'}</td>
                      <td style={{ ...tdStyle, display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setExpModal(e)} title="Edit">
                          <Pencil size={13} />
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => deleteExpense(e.id)}
                          title="Delete" style={{ color: '#dc2626', borderColor: '#fecaca' }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── RETURNS TAB ── */}
          {tab === 'returns' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                    {['Date', 'Title', 'Amount', 'Notes', 'Added By', ''].map(h => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {returns.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)', fontSize: 14 }}>No returns recorded yet</td></tr>
                  ) : returns.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                      <td style={tdStyle}>{r.return_date}</td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--gray-800)' }}>{r.title}</td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: '#16a34a' }}>{fmt(r.amount)}</td>
                      <td style={{ ...tdStyle, color: 'var(--gray-400)', fontSize: 13, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes || '—'}</td>
                      <td style={{ ...tdStyle, fontSize: 13, color: 'var(--gray-500)' }}>{r.created_by_name || '—'}</td>
                      <td style={{ ...tdStyle, display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setRetModal(r)} title="Edit">
                          <Pencil size={13} />
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => deleteReturn(r.id)}
                          title="Delete" style={{ color: '#dc2626', borderColor: '#fecaca' }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {expModal !== null && (
        <ExpenseModal
          expense={expModal?.id ? expModal : null}
          categories={categories}
          onClose={() => setExpModal(null)}
          onSaved={() => { setExpModal(null); fetchAll() }}
        />
      )}
      {retModal !== null && (
        <ReturnModal
          ret={retModal?.id ? retModal : null}
          onClose={() => setRetModal(null)}
          onSaved={() => { setRetModal(null); fetchAll() }}
        />
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const tdStyle = { padding: '12px 16px', fontSize: 14, color: 'var(--gray-700)', verticalAlign: 'middle' }

function EmptyChart() {
  return (
    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-300)', fontSize: 14 }}>
      No data for selected period
    </div>
  )
}

function nMonthsAgo(n) {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 10)
}