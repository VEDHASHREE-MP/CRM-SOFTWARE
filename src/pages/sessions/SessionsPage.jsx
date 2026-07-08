import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, RefreshCw, Pencil, Trash2, ChevronDown, Calendar, Mail, X } from 'lucide-react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import SessionModal from './SessionModal'
import WeeklyCalendar from './WeeklyCalendar'

const STATUSES = ['All', 'Scheduled', 'Completed', 'Cancelled']

const STATUS_BADGE = {
  Scheduled: 'badge-new',
  Completed: 'badge-converted',
  Cancelled: 'badge-closed'
}

function getMonday(dateStr) {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function fmt12h(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}

// ── Email Modal ───────────────────────────────────────────────────────────────
function SessionEmailModal({ session, onClose }) {
  const { addToast } = useToast()
  const [email,   setEmail]   = useState(session.customer_email || '')
  const [sending, setSending] = useState(false)
  const [msg,     setMsg]     = useState('')

  const handleSend = async () => {
    if (!email.trim()) { setMsg('Please enter a valid email address'); return }
    setSending(true)
    setMsg('')
    try {
      const res = await api.post(`/sessions/${session.id}/send-email`, {
        customer_email: email.trim()
      })
      setMsg(`✅ Confirmation sent to ${email}`)
      addToast(`Email sent to ${email}`, 'success', '✅')
      setTimeout(() => onClose(), 2000)
    } catch (e) {
      const errMsg = e?.response?.data?.error || 'Failed to send email'
      setMsg(`❌ ${errMsg}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={emailStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={emailStyles.modal}>
        {/* Header */}
        <div style={emailStyles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={16} color="var(--blue-600)" />
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' }}>
              Send Session Confirmation
            </span>
          </div>
          <button style={emailStyles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {/* Session summary */}
          <div style={emailStyles.summaryBox}>
            <SummaryRow label="Customer" value={session.customer_name} />
            <SummaryRow label="Service"  value={session.service} />
            <SummaryRow label="Date"     value={fmtDate(session.session_date)} />
            <SummaryRow label="Time"     value={fmt12h(session.session_time)} />
            <SummaryRow label="Mode"     value={session.mode === 'online' ? '💻 Online' : '🏢 Offline'} />
            {session.staff_name && <SummaryRow label="Staff" value={session.staff_name} />}
          </div>

          <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: '16px 0 8px' }}>
            A session confirmation email will be sent to the customer with all details above.
          </p>

          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', display: 'block', marginBottom: 6 }}>
            Customer Email <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="email"
            placeholder="customer@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            style={emailStyles.input}
            autoFocus
          />

          {msg && (
            <p style={{
              fontSize: 13, marginTop: 10,
              color: msg.startsWith('✅') ? 'var(--green-600)' : 'var(--red-600)'
            }}>
              {msg}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={emailStyles.footer}>
          <button
            style={{ padding: '8px 18px', borderRadius: 8, border: '1.5px solid var(--gray-200)', background: '#fff', color: 'var(--gray-600)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onClick={onClose}
            disabled={sending}
          >
            Cancel
          </button>
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: sending ? 'var(--gray-300)' : 'var(--blue-600)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer'
            }}
            onClick={handleSend}
            disabled={sending}
          >
            <Mail size={14} /> {sending ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: 'var(--gray-400)', fontWeight: 500 }}>{label}</span>
      <span style={{ color: 'var(--gray-800)', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

const emailStyles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1100, padding: 16
  },
  modal: {
    background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440,
    boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflow: 'hidden'
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 24px', borderBottom: '1px solid var(--gray-100)'
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--gray-400)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    padding: '16px 24px', borderTop: '1px solid var(--gray-100)'
  },
  summaryBox: {
    background: 'var(--gray-50)', borderRadius: 10,
    padding: '14px 16px', border: '1px solid var(--gray-200)'
  },
  input: {
    width: '100%', padding: '9px 12px',
    border: '1.5px solid var(--gray-200)', borderRadius: 8,
    fontSize: 14, outline: 'none', boxSizing: 'border-box'
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SessionsPage() {
  const { isAdmin } = useAuth()
  const { addToast } = useToast()

  const today = new Date().toISOString().slice(0, 10)
  const [weekStart,     setWeekStart]     = useState(getMonday(today))
  const [weekSessions,  setWeekSessions]  = useState([])
  const [allSessions,   setAllSessions]   = useState([])
  const [staffList,     setStaffList]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [calLoading,    setCalLoading]    = useState(false)

  const [search,           setSearch]           = useState('')
  const [statusFilter,     setStatusFilter]     = useState('All')
  const [staffFilter,      setStaffFilter]      = useState('')
  const [statusDropdownId, setStatusDropdownId] = useState(null)

  const [modalOpen,      setModalOpen]      = useState(false)
  const [editData,       setEditData]       = useState(null)
  const [deleteId,       setDeleteId]       = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)
  const [emailSession,   setEmailSession]   = useState(null)   // ← NEW

  const fetchWeek = useCallback(async (ws) => {
    setCalLoading(true)
    try {
      const res = await api.get(`/sessions/week?date=${ws}`)
      setWeekSessions(res.data.sessions)
    } catch {} finally { setCalLoading(false) }
  }, [])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'All') params.set('status', statusFilter)
      if (search)      params.set('search', search)
      if (staffFilter) params.set('staff',  staffFilter)
      const res = await api.get(`/sessions/?${params}`)
      setAllSessions(res.data)
    } catch {
      addToast('Failed to load sessions', 'error', '❌ Error')
    } finally { setLoading(false) }
  }, [statusFilter, search, staffFilter])

  useEffect(() => { fetchWeek(weekStart) }, [weekStart])
  useEffect(() => { fetchList() },          [fetchList])
  useEffect(() => {
    api.get('/team/members').then(r => setStaffList(r.data)).catch(() => {})
  }, [])

  const onSaved = () => { fetchWeek(weekStart); fetchList() }

  const handleEdit   = (s) => { setEditData(s); setModalOpen(true); setSelectedSession(null) }
  const handleAdd    = () =>  { setEditData(null); setModalOpen(true) }

  const handleDelete = async () => {
    try {
      await api.delete(`/sessions/${deleteId}`)
      addToast('Session deleted', 'success', '✅ Deleted')
      setDeleteId(null)
      onSaved()
    } catch { addToast('Failed to delete', 'error', '❌ Error') }
  }

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/sessions/${id}/status`, { status })
      setAllSessions(prev => prev.map(s => s.id === id ? { ...s, status } : s))
      fetchWeek(weekStart)
      setStatusDropdownId(null)
      addToast(`Status updated to ${status}`, 'success', '✅ Updated')
    } catch { addToast('Failed to update status', 'error', '❌ Error') }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Session Management</div>
          <div className="page-subtitle">{allSessions.length} session{allSessions.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => { fetchWeek(weekStart); fetchList() }}>
            <RefreshCw size={14} />
          </button>
          {isAdmin && (
            <button className="btn btn-primary" onClick={handleAdd}>
              <Plus size={15} /> Book Session
            </button>
          )}
        </div>
      </div>

      {/* Weekly Calendar */}
      <div style={{ marginBottom: 24, opacity: calLoading ? 0.6 : 1, transition: 'opacity 200ms' }}>
        <WeeklyCalendar
          weekStart={weekStart}
          sessions={weekSessions}
          onPrevWeek={() => setWeekStart(ws => addDays(ws, -7))}
          onNextWeek={() => setWeekStart(ws => addDays(ws, 7))}
          onSessionClick={s => setSelectedSession(s)}
        />
      </div>

      {/* Session detail popup from calendar click */}
      {selectedSession && (
        <SessionDetailPopup
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onEdit={() => handleEdit(selectedSession)}
          onEmail={() => { setEmailSession(selectedSession); setSelectedSession(null) }}
          isAdmin={isAdmin}
        />
      )}

      {/* Filters */}
      <div className="card" style={styles.filters}>
        <div style={styles.searchWrap}>
          <Search size={15} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
          <input
            className="form-input"
            style={{ paddingLeft: 10, border: 'none', background: 'transparent', outline: 'none', width: '100%' }}
            placeholder="Search by name, phone, service..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={styles.filterTabs}>
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{ ...styles.filterTab, ...(statusFilter === s ? styles.filterTabActive : {}) }}
            >
              {s}
            </button>
          ))}
        </div>

        {isAdmin && (
          <select
            className="form-input"
            style={{ minWidth: 160, fontSize: 13 }}
            value={staffFilter}
            onChange={e => setStaffFilter(e.target.value)}
          >
            <option value="">All Staff</option>
            {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* Sessions Table */}
      <div className="card" style={{ marginTop: 16, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : allSessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Calendar size={36} strokeWidth={1.5} color="var(--gray-300)" /></div>
            <div className="empty-state-title">No sessions found</div>
            <div className="empty-state-desc">Book a session from a converted enquiry to get started</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Date & Time</th>
                  <th>Duration</th>
                  <th>Mode</th>
                  <th>Staff</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allSessions.map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>{i + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{s.customer_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{s.phone}</div>
                    </td>
                    <td>{s.service}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{fmtDate(s.session_date)}</div>
                      <div style={{ fontSize: 12, color: 'var(--blue-600)' }}>{fmt12h(s.session_time)}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{s.duration}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 12, fontWeight: 500,
                        color: s.mode === 'online' ? 'var(--blue-700)' : 'var(--gray-600)',
                        background: s.mode === 'online' ? 'var(--blue-50)' : 'var(--gray-100)',
                        padding: '2px 8px', borderRadius: 99
                      }}>
                        {s.mode === 'online' ? '💻 Online' : '🏢 Offline'}
                      </span>
                    </td>
                    <td>
                      {s.staff_name
                        ? <span style={styles.staffPill}>{s.staff_name}</span>
                        : <span style={{ color: 'var(--gray-300)', fontSize: 12 }}>Unassigned</span>
                      }
                    </td>
                    <td style={{ position: 'relative' }}>
                      <button
                        className={`badge ${STATUS_BADGE[s.status]}`}
                        style={{ cursor: isAdmin ? 'pointer' : 'default', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => isAdmin && setStatusDropdownId(statusDropdownId === s.id ? null : s.id)}
                      >
                        {s.status} {isAdmin && <ChevronDown size={11} />}
                      </button>
                      {statusDropdownId === s.id && (
                        <StatusDropdown
                          current={s.status}
                          onSelect={st => handleStatusChange(s.id, st)}
                          onClose={() => setStatusDropdownId(null)}
                        />
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {/* ── Send Email button — visible to admin only ── */}
                        {isAdmin && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEmailSession(s)}
                            title="Send session confirmation email"
                            style={{ color: 'var(--blue-600)' }}
                          >
                            <Mail size={13} />
                          </button>
                        )}
                        {isAdmin && (
                          <>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(s)} title="Edit">
                              <Pencil size={13} />
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(s.id)} title="Delete">
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Session Modal (create / edit) */}
      <SessionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditData(null) }}
        onSaved={onSaved}
        editData={editData}
      />

      {/* Team member management — shown when editing a team session */}
      {editData && editData.team_id && (
        <SessionMembersPanel
          session={editData}
          onClose={() => { setEditData(null) }}
          onUpdated={onSaved}
        />
      )}

      {/* Email Modal ── NEW */}
      {emailSession && (
        <SessionEmailModal
          session={emailSession}
          onClose={() => setEmailSession(null)}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Session</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--gray-600)', lineHeight: 1.6 }}>
                Are you sure you want to delete this session? This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SessionDetailPopup({ session, onClose, onEdit, onEmail, isAdmin }) {
  const fmt12h = (t) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    const hour = parseInt(h)
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">Session Details</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <DetailRow label="Customer" value={session.customer_name} />
            <DetailRow label="Phone"    value={session.phone} />
            <DetailRow label="Service"  value={session.service} />
            <DetailRow label="Date"     value={new Date(session.session_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
            <DetailRow label="Time"     value={fmt12h(session.session_time)} />
            <DetailRow label="Duration" value={session.duration} />
            <DetailRow label="Mode"     value={session.mode === 'online' ? '💻 Online' : '🏢 Offline'} />
            {session.location_or_link && <DetailRow label={session.mode === 'online' ? 'Link' : 'Location'} value={session.location_or_link} />}
            <DetailRow label="Staff"    value={session.staff_name || 'Unassigned'} />
            <DetailRow label="Status"   value={session.status} />
            {session.notes && <DetailRow label="Notes" value={session.notes} />}
          </div>
        </div>
        {isAdmin && (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
            {/* ── Send Email from detail popup too ── */}
            <button
              className="btn btn-secondary"
              onClick={onEmail}
              style={{ color: 'var(--blue-600)', borderColor: 'var(--blue-200)', background: 'var(--blue-50)', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Mail size={14} /> Send Email
            </button>
            <button className="btn btn-primary" onClick={onEdit}>
              <Pencil size={14} /> Edit
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ width: 90, fontSize: 12, fontWeight: 600, color: 'var(--gray-400)', flexShrink: 0, paddingTop: 1 }}>{label}</div>
      <div style={{ fontSize: 14, color: 'var(--gray-800)', flex: 1 }}>{value}</div>
    </div>
  )
}

function StatusDropdown({ current, onSelect, onClose }) {
  const STATUSES = ['Scheduled', 'Completed', 'Cancelled']
  useEffect(() => {
    const h = () => onClose()
    setTimeout(() => document.addEventListener('click', h), 0)
    return () => document.removeEventListener('click', h)
  }, [])

  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 300,
      background: '#fff', border: '1px solid var(--gray-200)',
      borderRadius: 8, boxShadow: 'var(--shadow-md)',
      minWidth: 130, overflow: 'hidden', marginTop: 4
    }}>
      {STATUSES.map(s => (
        <button
          key={s}
          onClick={e => { e.stopPropagation(); onSelect(s) }}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '8px 14px', fontSize: 13,
            background: s === current ? 'var(--blue-50)' : 'none',
            color: s === current ? 'var(--blue-700)' : 'var(--gray-700)',
            border: 'none', fontWeight: s === current ? 600 : 400, cursor: 'pointer'
          }}
        >{s}</button>
      ))}
    </div>
  )
}

const styles = {
  filters: { padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  searchWrap: {
    flex: 1, minWidth: 200,
    display: 'flex', alignItems: 'center',
    background: 'var(--gray-50)', borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--gray-200)',
    borderRadius: 'var(--radius-sm)', paddingLeft: 10
  },
  filterTabs: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  filterTab: {
    padding: '5px 12px', borderRadius: 99, fontSize: 13, fontWeight: 500,
    border: '1px solid var(--gray-200)', background: '#fff',
    color: 'var(--gray-600)', cursor: 'pointer', transition: 'all 150ms'
  },
  filterTabActive: { background: 'var(--blue-600)', color: '#fff', borderColor: 'var(--blue-600)' },
  staffPill: {
    display: 'inline-block', padding: '2px 8px', borderRadius: 99,
    background: 'var(--blue-50)', color: 'var(--blue-700)', fontSize: 12, fontWeight: 500
  }
}
// ── SessionMembersPanel ───────────────────────────────────────────────────────
// Shown in the edit flow when a session belongs to a team.
// Allows adding/removing members from the session without re-booking.
function SessionMembersPanel({ session, onClose, onUpdated }) {
  const { addToast } = useToast()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchMembers = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/sessions/${session.id}/members`)
      setData(res.data)
    } catch {
      addToast('Failed to load session members', 'error', '❌ Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMembers() }, [session.id])

  const handleRemove = async (memberId) => {
    try {
      await api.delete(`/sessions/${session.id}/members/${memberId}`)
      addToast('Member removed', 'success', '✅ Removed')
      fetchMembers()
      onUpdated()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to remove member', 'error', '❌ Error')
    }
  }

  const handleAdd = async (memberId) => {
    try {
      await api.post(`/sessions/${session.id}/members`, { member_id: memberId })
      addToast('Member added', 'success', '✅ Added')
      fetchMembers()
      onUpdated()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to add member', 'error', '❌ Error')
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title">Manage Session Members</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="loading-center"><div className="spinner" /></div>
          ) : (
            <>
              {/* Attending */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                  Attending ({(data?.attending || []).length})
                </div>
                {(data?.attending || []).length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>No members attending yet.</div>
                ) : (
                  (data?.attending || []).map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: 'var(--green-50)', border: '1px solid #bbf7d0', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</span>
                        {m.phone && <span style={{ fontSize: 12, color: 'var(--gray-400)', marginLeft: 8 }}>{m.phone}</span>}
                      </div>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-500)', padding: '2px 8px' }}
                        onClick={() => handleRemove(m.id)} title="Remove from session">
                        <X size={13} /> Remove
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Not yet attending */}
              {(data?.remaining || []).length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                    Add from Team ({(data?.remaining || []).length} remaining)
                  </div>
                  {(data?.remaining || []).map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: 'var(--gray-50)', border: '1px solid var(--gray-200)', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</span>
                        {m.phone && <span style={{ fontSize: 12, color: 'var(--gray-400)', marginLeft: 8 }}>{m.phone}</span>}
                      </div>
                      <button className="btn btn-primary btn-sm" style={{ padding: '4px 12px' }}
                        onClick={() => handleAdd(m.id)}>
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
