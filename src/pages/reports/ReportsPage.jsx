import { useState, useEffect, useCallback } from 'react'
import {
  Download, Calendar, TrendingUp, Users, ClipboardList,
  CheckCircle, Clock, XCircle, Receipt, IndianRupee, RefreshCw
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid
} from 'recharts'
import api from '../../api/axios'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'

const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const COLORS = {
  blue:   '#2563eb',
  green:  '#16a34a',
  amber:  '#d97706',
  red:    '#dc2626',
  purple: '#7c3aed',
  gray:   '#64748b',
  teal:   '#0d9488',
  pink:   '#db2777',
}

const PIE_PALETTE = ['#2563eb','#16a34a','#d97706','#7c3aed','#0d9488','#db2777','#dc2626','#64748b']

const STATUS_COLORS = {
  New:         COLORS.blue,
  'Follow-up': COLORS.amber,
  Converted:   COLORS.green,
  Closed:      COLORS.gray,
  Scheduled:   COLORS.blue,
  Completed:   COLORS.green,
  Cancelled:   COLORS.red,
}

export default function ReportsPage() {
  const { addToast } = useToast()
  const { isAdmin }  = useAuth()

  const today     = new Date().toISOString().slice(0, 10)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  const [dateFrom, setDateFrom] = useState(monthStart)
  const [dateTo,   setDateTo]   = useState(today)
  const [summary,  setSummary]  = useState(null)
  const [charts,   setCharts]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [downloading, setDownloading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (dateFrom) params.date_from = dateFrom
      if (dateTo)   params.date_to   = dateTo

      const [sumRes, chartRes] = await Promise.all([
        api.get('/reports/summary', { params }),
        api.get('/reports/charts',  { params }),
      ])
      setSummary(sumRes.data)
      setCharts(chartRes.data)
    } catch {
      addToast('Failed to load report data', 'error', '❌ Error')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo)   params.set('date_to',   dateTo)

      const token = localStorage.getItem('vtcrm_token')
      const res = await fetch(`http://localhost:5000/api/reports/download?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `VirtualTech_Report_${dateFrom}_${dateTo}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      addToast('Report downloaded successfully', 'success', '✅ Downloaded')
    } catch {
      addToast('Failed to download report', 'error', '❌ Error')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <div className="page-title">Reports & Analytics</div>
          <div className="page-subtitle">
            {dateFrom} → {dateTo}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
            <RefreshCw size={15} />
          </button>
          <button className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
            <Download size={15} />
            {downloading ? 'Downloading…' : 'Download Excel'}
          </button>
        </div>
      </div>

      {/* ── Date Range Filter ── */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={16} color="var(--gray-400)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-600)' }}>Date Range</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="date" className="form-input"
            style={{ width: 160, fontSize: 14 }}
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
          />
          <span style={{ color: 'var(--gray-400)', fontSize: 14 }}>to</span>
          <input
            type="date" className="form-input"
            style={{ width: 160, fontSize: 14 }}
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
          />
        </div>

        {/* Quick range buttons */}
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {[
            { label: 'This Month', from: monthStart, to: today },
            { label: 'Last 3 Months', from: nMonthsAgo(3), to: today },
            { label: 'This Year', from: `${new Date().getFullYear()}-01-01`, to: today },
            { label: 'All Time', from: '', to: '' },
          ].map(r => (
            <button
              key={r.label}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 12, ...(dateFrom === r.from && dateTo === r.to ? { background: 'var(--blue-600)', color: '#fff', borderColor: 'var(--blue-600)' } : {}) }}
              onClick={() => { setDateFrom(r.from); setDateTo(r.to) }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          {/* ── Enquiry Summary ── */}
          <SectionTitle icon="📋" title="Enquiries" />
          <div style={styles.cardGrid}>
            <SummaryCard label="Total Enquiries"  value={summary?.enquiries?.total}           color={COLORS.blue}   icon={<ClipboardList size={20} />} />
            <SummaryCard label="New"               value={summary?.enquiries?.new}             color={COLORS.blue}   icon={<ClipboardList size={20} />} />
            <SummaryCard label="Follow-up"         value={summary?.enquiries?.follow_up}       color={COLORS.amber}  icon={<Clock size={20} />} />
            <SummaryCard label="Converted"         value={summary?.enquiries?.converted}       color={COLORS.green}  icon={<CheckCircle size={20} />} />
            <SummaryCard label="Closed"            value={summary?.enquiries?.closed}          color={COLORS.gray}   icon={<XCircle size={20} />} />
            <SummaryCard label="Conversion Rate"   value={`${summary?.enquiries?.conversion_rate ?? 0}%`} color={COLORS.purple} icon={<TrendingUp size={20} />} />
          </div>

          {/* Enquiry Charts */}
          <div style={styles.chartRow}>
            <ChartCard title="Enquiries by Status">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart margin={{ top: 20, right: 30, bottom: 10, left: 30 }}>
                  <Pie data={charts?.enquiries_by_status?.map(r => ({ name: r.status, value: r.cnt }))}
                    cx="50%" cy="48%" outerRadius={80} dataKey="value" nameKey="name"
                    label={({ name, percent, x, y, textAnchor }) => (
                            <text x={x} y={y} textAnchor={textAnchor} fill="#374151" fontSize={12} fontWeight={500}>
                              {`${name} ${(percent * 100).toFixed(0)}%`}
                            </text>
                          )}
                          labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                  >
                    {charts?.enquiries_by_status?.map((r, i) => (
                      <Cell key={i} fill={STATUS_COLORS[r.status] || PIE_PALETTE[i % PIE_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v, 'Count']} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Enquiries by Source">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={charts?.enquiries_by_source?.map(r => ({ name: r.source, count: r.cnt }))} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Enquiries Trend (Monthly)">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={charts?.enquiries_trend?.map(r => ({ month: r.month, Enquiries: r.cnt }))} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Enquiries" stroke={COLORS.blue} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* ── Session Summary ── */}
          <SectionTitle icon="🗓️" title="Sessions" />
          <div style={styles.cardGrid}>
            <SummaryCard label="Total Sessions"    value={summary?.sessions?.total}       color={COLORS.blue}   icon={<Calendar size={20} />} />
            <SummaryCard label="Completed"         value={summary?.sessions?.completed}   color={COLORS.green}  icon={<CheckCircle size={20} />} />
            <SummaryCard label="Scheduled"         value={summary?.sessions?.scheduled}   color={COLORS.purple} icon={<Clock size={20} />} />
            <SummaryCard label="Cancelled"         value={summary?.sessions?.cancelled}   color={COLORS.red}    icon={<XCircle size={20} />} />
            <SummaryCard label="Completion Rate"   value={`${summary?.sessions?.completion_rate ?? 0}%`} color={COLORS.teal} icon={<TrendingUp size={20} />} />
          </div>

          <div style={styles.chartRow}>
            <ChartCard title="Sessions by Status">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart margin={{ top: 20, right: 30, bottom: 10, left: 30 }}>
                  <Pie data={charts?.sessions_by_status?.map(r => ({ name: r.status, value: r.cnt }))}
                    cx="50%" cy="48%" outerRadius={80} dataKey="value" nameKey="name"
                    label={({ name, percent, x, y, textAnchor }) => (
                            <text x={x} y={y} textAnchor={textAnchor} fill="#374151" fontSize={12} fontWeight={500}>
                              {`${name} ${(percent * 100).toFixed(0)}%`}
                            </text>
                          )}
                          labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                  >
                    {charts?.sessions_by_status?.map((r, i) => (
                      <Cell key={i} fill={STATUS_COLORS[r.status] || PIE_PALETTE[i % PIE_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v, 'Count']} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            {isAdmin && charts?.sessions_by_staff?.length > 0 && (
              <ChartCard title="Sessions by Staff">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.sessions_by_staff.map(r => ({ name: r.staff, Sessions: r.cnt }))} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="Sessions" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* ── Billing Summary (admin only) ── */}
          {isAdmin && summary?.billing && (
            <>
              <SectionTitle icon="💰" title="Billing" />
              <div style={styles.cardGrid}>
                <SummaryCard label="Total Invoiced"  value={fmt(summary.billing.total_invoiced)} color={COLORS.blue}   icon={<Receipt size={20} />} />
                <SummaryCard label="Total Paid"      value={fmt(summary.billing.total_paid)}     color={COLORS.green}  icon={<IndianRupee size={20} />} />
                <SummaryCard label="Outstanding Due" value={fmt(summary.billing.total_due)}      color={COLORS.red}    icon={<Clock size={20} />} />
                <SummaryCard label="Invoices"        value={summary.billing.invoice_count}       color={COLORS.gray}   icon={<Receipt size={20} />} />
              </div>

              {charts?.revenue_trend?.length > 0 && (
                <div style={{ ...styles.chartRow, gridTemplateColumns: '1fr' }}>
                  <ChartCard title="Monthly Revenue Trend">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={charts.revenue_trend.map(r => ({ month: r.month, Revenue: r.revenue }))} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v) => [fmt(v), 'Revenue']} />
                        <Bar dataKey="Revenue" fill={COLORS.green} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              )}
            </>
          )}

          {/* ── Customer Summary (admin only) ── */}
          {isAdmin && summary?.customers && (
            <>
              <SectionTitle icon="👥" title="Customers" />
              <div style={styles.cardGrid}>
                <SummaryCard label="Total Customers" value={summary.customers.total}   color={COLORS.blue}   icon={<Users size={20} />} />
                <SummaryCard label="VIP"             value={summary.customers.vip}     color={COLORS.amber}  icon={<Users size={20} />} />
                <SummaryCard label="Loyal"           value={summary.customers.loyal}   color={COLORS.purple} icon={<Users size={20} />} />
                <SummaryCard label="Regular"         value={summary.customers.regular} color={COLORS.teal}   icon={<Users size={20} />} />
                <SummaryCard label="New"             value={summary.customers.new}     color={COLORS.gray}   icon={<Users size={20} />} />
              </div>

              {charts?.loyalty_breakdown?.length > 0 && (
                <div style={styles.chartRow}>
                  <ChartCard title="Customer Loyalty Breakdown">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart margin={{ top: 20, right: 30, bottom: 10, left: 30 }}>
                        <Pie
                          data={charts.loyalty_breakdown.map(r => ({ name: r.tier, value: Number(r.cnt) }))}
                          cx="50%" cy="48%" outerRadius={85} dataKey="value"
                          nameKey="name"
                          label={({ name, percent, x, y, textAnchor }) => (
                            <text x={x} y={y} textAnchor={textAnchor} fill="#374151" fontSize={12} fontWeight={500}>
                              {`${name} ${(percent * 100).toFixed(0)}%`}
                            </text>
                          )}
                          labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                        >
                          {charts.loyalty_breakdown.map((r, i) => (
                            <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, name) => [v + ' customers', name]} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={10} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Helper components ─────────────────────────────────────────────────────────

function SectionTitle({ icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '28px 0 12px' }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontFamily: 'var(--font-head)', fontSize: 17, fontWeight: 700, color: 'var(--gray-800)' }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--gray-200)', marginLeft: 8 }} />
    </div>
  )
}

function SummaryCard({ label, value, color, icon }) {
  return (
    <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: color + '15', color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', lineHeight: 1 }}>
          {value ?? '—'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 4 }}>{label}</div>
      </div>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function nMonthsAgo(n) {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 10)
}

const styles = {
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    gap: 14
  },
  chartRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 16,
    marginTop: 16
  }
}