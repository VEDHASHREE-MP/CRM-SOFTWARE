import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Search, Pencil, Trash2, ChevronDown, RefreshCw,
  Users, User, ChevronRight, Upload, X
} from 'lucide-react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import EnquiryModal from './EnquiryModal'
import TeamEnquiryModal from './TeamEnquiryModal'

const STATUSES = ['All', 'New', 'Follow-up', 'Converted', 'Closed']

const STATUS_BADGE = {
  'New':       'badge-new',
  'Follow-up': 'badge-followup',
  'Converted': 'badge-converted',
  'Closed':    'badge-closed'
}

export default function EnquiriesPage() {
  const { isAdmin } = useAuth()
  const { addToast } = useToast()

  // ── view mode ────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState('individual') // 'individual' | 'team'

  // ── individual state ─────────────────────────────────────────
  const [enquiries, setEnquiries]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState('All')
  const [staff, setStaff]                 = useState([])
  const [assignedFilter, setAssignedFilter] = useState('')
  const [modalOpen, setModalOpen]         = useState(false)
  const [editData, setEditData]           = useState(null)
  const [deleteId, setDeleteId]           = useState(null)
  const [statusDropdownId, setStatusDropdownId] = useState(null)

  // ── team state ───────────────────────────────────────────────
  const [teams, setTeams]                 = useState([])
  const [teamsLoading, setTeamsLoading]   = useState(false)
  const [teamStatusFilter, setTeamStatusFilter] = useState('All')
  const [teamSearch, setTeamSearch]       = useState('')
  const [expandedTeam, setExpandedTeam]   = useState(null)
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [editTeam, setEditTeam]           = useState(null)
  const [deleteTeamId, setDeleteTeamId]   = useState(null)
  const [teamStatusDropdownId, setTeamStatusDropdownId] = useState(null)

  // ── CSV import ───────────────────────────────────────────────
  const [csvImporting, setCsvImporting]   = useState(false)
  const csvInputRef                       = useRef(null)

  // ── fetch individual enquiries ────────────────────────────────
  const fetchEnquiries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'All') params.set('status', statusFilter)
      if (search) params.set('search', search)
      if (assignedFilter) params.set('assigned_to', assignedFilter)
      const res = await api.get(`/enquiries/?${params}`)
      setEnquiries(res.data)
    } catch {
      addToast('Failed to load enquiries', 'error', '❌ Error')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search, assignedFilter])

  // ── fetch team enquiries ──────────────────────────────────────
  const fetchTeams = useCallback(async () => {
    setTeamsLoading(true)
    try {
      const params = new URLSearchParams()
      if (teamStatusFilter !== 'All') params.set('status', teamStatusFilter)
      if (teamSearch) params.set('search', teamSearch)
      const res = await api.get(`/team-enquiries/?${params}`)
      setTeams(res.data)
    } catch {
      addToast('Failed to load teams', 'error', '❌ Error')
    } finally {
      setTeamsLoading(false)
    }
  }, [teamStatusFilter, teamSearch])

  useEffect(() => { fetchEnquiries() }, [fetchEnquiries])
  useEffect(() => { if (viewMode === 'team') fetchTeams() }, [fetchTeams, viewMode])
  useEffect(() => {
    api.get('/team/members').then(r => setStaff(r.data)).catch(() => {})
  }, [])

  // ── individual handlers ───────────────────────────────────────
  const handleEdit  = (e) => { setEditData(e); setModalOpen(true) }
  const handleAdd   = ()  => { setEditData(null); setModalOpen(true) }
  const handleDelete = async () => {
    try {
      await api.delete(`/enquiries/${deleteId}`)
      addToast('Enquiry deleted', 'success', '✅ Deleted')
      setDeleteId(null)
      fetchEnquiries()
    } catch {
      addToast('Failed to delete', 'error', '❌ Error')
    }
  }
  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/enquiries/${id}/status`, { status })
      setEnquiries(prev => prev.map(e => e.id === id ? { ...e, status } : e))
      setStatusDropdownId(null)
      addToast(`Status updated to ${status}`, 'success', '✅ Updated')
    } catch {
      addToast('Failed to update status', 'error', '❌ Error')
    }
  }

  // ── team handlers ─────────────────────────────────────────────
  const handleTeamStatusChange = async (id, status) => {
    try {
      await api.patch(`/team-enquiries/${id}/status`, { status })
      setTeamStatusDropdownId(null)
      addToast(`Team status updated to ${status}`, 'success', '✅ Updated')
      fetchTeams()
    } catch {
      addToast('Failed to update status', 'error', '❌ Error')
    }
  }
  const handleDeleteTeam = async () => {
    try {
      await api.delete(`/team-enquiries/${deleteTeamId}`)
      addToast('Team deleted', 'success', '✅ Deleted')
      setDeleteTeamId(null)
      fetchTeams()
    } catch {
      addToast('Failed to delete team', 'error', '❌ Error')
    }
  }

  // ── CSV import ────────────────────────────────────────────────
  const handleCsvImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setCsvImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/team-enquiries/import-csv', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      addToast(res.data.message, 'success', '✅ Imported')
      fetchTeams()
    } catch (err) {
      addToast(err.response?.data?.error || 'CSV import failed', 'error', '❌ Error')
    } finally {
      setCsvImporting(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Enquiry Management</div>
          <div className="page-subtitle">
            {viewMode === 'individual'
              ? `${enquiries.length} enquir${enquiries.length === 1 ? 'y' : 'ies'} found`
              : `${teams.length} team${teams.length === 1 ? '' : 's'} found`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={viewMode === 'individual' ? fetchEnquiries : fetchTeams}>
            <RefreshCw size={14} />
          </button>
          {viewMode === 'team' && (
            <>
              <input
                type="file"
                accept=".csv"
                ref={csvInputRef}
                style={{ display: 'none' }}
                onChange={handleCsvImport}
              />
              <button
                className="btn btn-secondary"
                onClick={() => csvInputRef.current?.click()}
                disabled={csvImporting}
                title="Import teams from CSV"
              >
                <Upload size={14} /> {csvImporting ? 'Importing…' : 'Import CSV'}
              </button>
              <button className="btn btn-primary" onClick={() => { setEditTeam(null); setTeamModalOpen(true) }}>
                <Plus size={15} /> Add Team
              </button>
            </>
          )}
          {viewMode === 'individual' && (
            <button className="btn btn-primary" onClick={handleAdd}>
              <Plus size={15} /> Add Enquiry
            </button>
          )}
        </div>
      </div>

      {/* Individual / Team toggle */}
      <div style={styles.modeToggleWrap}>
        <button
          style={{ ...styles.modeToggleBtn, ...(viewMode === 'individual' ? styles.modeToggleBtnActive : {}) }}
          onClick={() => setViewMode('individual')}
        >
          <User size={13} /> Individual
        </button>
        <button
          style={{ ...styles.modeToggleBtn, ...(viewMode === 'team' ? styles.modeToggleBtnActive : {}) }}
          onClick={() => setViewMode('team')}
        >
          <Users size={13} /> Team
        </button>
      </div>

      {/* ── INDIVIDUAL VIEW ── */}
      {viewMode === 'individual' && (
        <>
          {/* Filters */}
          <div className="card" style={styles.filters}>
            <div style={styles.searchWrap}>
              <Search size={15} style={styles.searchIcon} />
              <input
                className="form-input"
                style={{ paddingLeft: 34, border: 'none', background: 'transparent', outline: 'none', width: '100%' }}
                placeholder="Search by name, phone, service..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div style={styles.filterTabs}>
              {STATUSES.map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  style={{ ...styles.filterTab, ...(statusFilter === s ? styles.filterTabActive : {}) }}>
                  {s}
                </button>
              ))}
            </div>
            {isAdmin && (
              <select className="form-input" style={{ minWidth: 160, fontSize: 13 }}
                value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)}>
                <option value="">All Staff</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>

          {/* Table */}
          <div className="card" style={{ marginTop: 16, overflow: 'hidden' }}>
            {loading ? (
              <div className="loading-center"><div className="spinner" /></div>
            ) : enquiries.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <div className="empty-state-title">No enquiries found</div>
                <div className="empty-state-desc">Try adjusting your filters or add a new enquiry</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>Customer</th><th>Phone</th><th>Service</th>
                      <th>Source</th><th>Status</th><th>Assigned To</th>
                      <th>Follow-up</th><th>Date</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enquiries.map((e, i) => (
                      <tr key={e.id}>
                        <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>{i + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{e.name}</div>
                          {e.notes && (
                            <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {e.notes}
                            </div>
                          )}
                        </td>
                        <td><a href={`tel:${e.phone}`} style={{ color: 'var(--blue-600)', fontWeight: 500 }}>{e.phone}</a></td>
                        <td>{e.service}</td>
                        <td><span style={styles.sourcePill}>{e.source}</span></td>
                        <td style={{ position: 'relative' }}>
                          <button
                            className={`badge ${STATUS_BADGE[e.status]}`}
                            style={{ cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => setStatusDropdownId(statusDropdownId === e.id ? null : e.id)}
                          >
                            {e.status} <ChevronDown size={11} />
                          </button>
                          {statusDropdownId === e.id && (
                            <StatusDropdown current={e.status}
                              onSelect={s => handleStatusChange(e.id, s)}
                              onClose={() => setStatusDropdownId(null)} />
                          )}
                        </td>
                        <td>
                          {e.assigned_to_name
                            ? <span style={styles.assignedPill}>{e.assigned_to_name}</span>
                            : <span style={{ color: 'var(--gray-300)', fontSize: 12 }}>Unassigned</span>}
                        </td>
                        <td>
                          {e.follow_up_date
                            ? <span style={{ fontSize: 12, fontWeight: 500, color: isToday(e.follow_up_date) ? 'var(--red-600)' : 'var(--gray-600)', background: isToday(e.follow_up_date) ? 'var(--red-50)' : 'transparent', padding: isToday(e.follow_up_date) ? '2px 6px' : 0, borderRadius: 4 }}>
                                {isToday(e.follow_up_date) ? '🔔 Today' : fmtDate(e.follow_up_date)}
                              </span>
                            : <span style={{ color: 'var(--gray-300)', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--gray-400)' }}>{fmtDate(e.created_at)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(e)} title="Edit"><Pencil size={13} /></button>
                            {isAdmin && (
                              <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(e.id)} title="Delete"><Trash2 size={13} /></button>
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
        </>
      )}

      {/* ── TEAM VIEW ── */}
      {viewMode === 'team' && (
        <>
          {/* Team filters */}
          <div className="card" style={styles.filters}>
            <div style={styles.searchWrap}>
              <Search size={15} style={styles.searchIcon} />
              <input
                className="form-input"
                style={{ paddingLeft: 34, border: 'none', background: 'transparent', outline: 'none', width: '100%' }}
                placeholder="Search by team name..."
                value={teamSearch}
                onChange={e => setTeamSearch(e.target.value)}
              />
            </div>
            <div style={styles.filterTabs}>
              {STATUSES.map(s => (
                <button key={s} onClick={() => setTeamStatusFilter(s)}
                  style={{ ...styles.filterTab, ...(teamStatusFilter === s ? styles.filterTabActive : {}) }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* CSV hint */}
          <div style={styles.csvHint}>
            <Upload size={13} />
            CSV columns: <strong>Name, Phone, Email, Service, Team Name, Source</strong> — rows grouped by Team Name
          </div>

          {/* Team cards */}
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {teamsLoading ? (
              <div className="loading-center"><div className="spinner" /></div>
            ) : teams.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">👥</div>
                  <div className="empty-state-title">No teams found</div>
                  <div className="empty-state-desc">Add a team manually or import from CSV</div>
                </div>
              </div>
            ) : (
              teams.map(team => (
                <TeamCard
                  key={team.id}
                  team={team}
                  expanded={expandedTeam === team.id}
                  onToggle={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
                  onEdit={() => { setEditTeam(team); setTeamModalOpen(true) }}
                  onDelete={() => setDeleteTeamId(team.id)}
                  onStatusChange={handleTeamStatusChange}
                  statusDropdownId={teamStatusDropdownId}
                  setStatusDropdownId={setTeamStatusDropdownId}
                  isAdmin={isAdmin}
                  onMemberUpdated={fetchTeams}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Add/Edit Individual Modal */}
      <EnquiryModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditData(null) }}
        onSaved={fetchEnquiries}
        editData={editData}
      />

      {/* Add/Edit Team Modal */}
      <TeamEnquiryModal
        open={teamModalOpen}
        onClose={() => { setTeamModalOpen(false); setEditTeam(null) }}
        onSaved={fetchTeams}
        editData={editTeam}
      />

      {/* Delete individual confirmation */}
      {deleteId && (
        <ConfirmDialog
          title="Delete Enquiry"
          message="Are you sure you want to delete this enquiry? This action cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {/* Delete team confirmation */}
      {deleteTeamId && (
        <ConfirmDialog
          title="Delete Team"
          message="Are you sure you want to delete this team and all its members? This cannot be undone."
          onConfirm={handleDeleteTeam}
          onCancel={() => setDeleteTeamId(null)}
        />
      )}
    </div>
  )
}

// ── TeamCard ─────────────────────────────────────────────────────────────────
function TeamCard({ team, expanded, onToggle, onEdit, onDelete, onStatusChange,
  statusDropdownId, setStatusDropdownId, isAdmin, onMemberUpdated }) {
  const { addToast } = useToast()
  const [addingMember, setAddingMember]   = useState(false)
  const [newMember, setNewMember]         = useState({ name: '', phone: '', email: '' })

  const handleAddMember = async () => {
    if (!newMember.name.trim()) return
    try {
      await api.post(`/team-enquiries/${team.id}/members`, newMember)
      addToast('Member added', 'success', '✅ Added')
      setNewMember({ name: '', phone: '', email: '' })
      setAddingMember(false)
      onMemberUpdated()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to add member', 'error', '❌ Error')
    }
  }

  const handleRemoveMember = async (memberId) => {
    try {
      await api.delete(`/team-enquiries/${team.id}/members/${memberId}`)
      addToast('Member removed', 'success', '✅ Removed')
      onMemberUpdated()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to remove member', 'error', '❌ Error')
    }
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Card header */}
      <div style={styles.teamCardHeader} onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={styles.teamIcon}><Users size={16} /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray-900)' }}>{team.team_name}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 1 }}>
              {team.service} · {team.source} · <strong>{team.member_count}</strong> member{team.member_count !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Status dropdown */}
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button
              className={`badge ${STATUS_BADGE[team.status]}`}
              style={{ cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={() => setStatusDropdownId(statusDropdownId === team.id ? null : team.id)}
            >
              {team.status} <ChevronDown size={11} />
            </button>
            {statusDropdownId === team.id && (
              <StatusDropdown
                current={team.status}
                onSelect={s => onStatusChange(team.id, s)}
                onClose={() => setStatusDropdownId(null)}
              />
            )}
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
              <button className="btn btn-ghost btn-sm" onClick={onEdit}><Pencil size={13} /></button>
              <button className="btn btn-danger btn-sm" onClick={onDelete}><Trash2 size={13} /></button>
            </div>
          )}
          <ChevronRight size={16} style={{ color: 'var(--gray-400)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 200ms' }} />
        </div>
      </div>

      {/* Expanded members */}
      {expanded && (
        <div style={styles.membersSection}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Members
          </div>
          {(team.members || []).map(m => (
            <div key={m.id} style={styles.memberRow}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-800)' }}>{m.name}</span>
                {m.phone && <span style={styles.memberMeta}> · {m.phone}</span>}
                {m.email && <span style={styles.memberMeta}> · {m.email}</span>}
              </div>
              {isAdmin && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--red-500)', padding: '2px 6px' }}
                  onClick={() => handleRemoveMember(m.id)}
                  title="Remove member"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}

          {/* Add member inline */}
          {isAdmin && (
            addingMember ? (
              <div style={styles.addMemberForm}>
                <input className="form-input" placeholder="Name *" style={{ flex: 1 }}
                  value={newMember.name} onChange={e => setNewMember(f => ({ ...f, name: e.target.value }))} />
                <input className="form-input" placeholder="Phone" style={{ flex: 1 }}
                  value={newMember.phone} onChange={e => setNewMember(f => ({ ...f, phone: e.target.value }))} />
                <input className="form-input" placeholder="Email" style={{ flex: 1 }}
                  value={newMember.email} onChange={e => setNewMember(f => ({ ...f, email: e.target.value }))} />
                <button className="btn btn-primary btn-sm" onClick={handleAddMember}>Add</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setAddingMember(false)}>Cancel</button>
              </div>
            ) : (
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 8, fontSize: 12, color: 'var(--blue-600)' }}
                onClick={() => setAddingMember(true)}
              >
                <Plus size={13} /> Add Member
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ── StatusDropdown ────────────────────────────────────────────────────────────
function StatusDropdown({ current, onSelect, onClose }) {
  const OPTS = ['New', 'Follow-up', 'Converted', 'Closed']
  useEffect(() => {
    const h = () => onClose()
    setTimeout(() => document.addEventListener('click', h), 0)
    return () => document.removeEventListener('click', h)
  }, [])
  return (
    <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 300, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8, boxShadow: 'var(--shadow-md)', minWidth: 130, overflow: 'hidden', marginTop: 4 }}>
      {OPTS.map(s => (
        <button key={s} onClick={e => { e.stopPropagation(); onSelect(s) }}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, background: s === current ? 'var(--blue-50)' : 'none', color: s === current ? 'var(--blue-700)' : 'var(--gray-700)', border: 'none', fontWeight: s === current ? 600 : 400 }}>
          {s}
        </button>
      ))}
    </div>
  )
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 14, color: 'var(--gray-600)', lineHeight: 1.6 }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const isToday  = (d) => d && d.slice(0, 10) === new Date().toISOString().slice(0, 10)
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'

const styles = {
  modeToggleWrap: {
    display: 'flex', gap: 0, marginBottom: 14,
    border: '1.5px solid var(--gray-200)', borderRadius: 10,
    overflow: 'hidden', background: 'var(--gray-50)',
    width: 'fit-content',
  },
  modeToggleBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 20px', fontSize: 13, fontWeight: 600,
    border: 'none', cursor: 'pointer',
    background: 'transparent', color: 'var(--gray-500)',
    transition: 'all 150ms',
  },
  modeToggleBtnActive: {
    background: '#fff', color: 'var(--blue-700)',
    boxShadow: '0 1px 4px rgba(0,0,0,.08)',
  },
  filters: { padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  searchWrap: {
    flex: 1, minWidth: 200, position: 'relative', display: 'flex', alignItems: 'center',
    background: 'var(--gray-50)', borderWidth: '1.5px', borderStyle: 'solid',
    borderColor: 'var(--gray-200)', borderRadius: 'var(--radius-sm)', paddingLeft: 10,
  },
  searchIcon: { color: 'var(--gray-400)', flexShrink: 0 },
  filterTabs: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  filterTab: {
    padding: '5px 12px', borderRadius: 99, fontSize: 13, fontWeight: 500,
    border: '1px solid var(--gray-200)', background: '#fff', color: 'var(--gray-600)',
    cursor: 'pointer', transition: 'all 150ms',
  },
  filterTabActive: { background: 'var(--blue-600)', color: '#fff', borderColor: 'var(--blue-600)' },
  sourcePill: { display: 'inline-block', padding: '2px 8px', borderRadius: 99, background: 'var(--gray-100)', color: 'var(--gray-600)', fontSize: 12, fontWeight: 500 },
  assignedPill: { display: 'inline-block', padding: '2px 8px', borderRadius: 99, background: 'var(--blue-50)', color: 'var(--blue-700)', fontSize: 12, fontWeight: 500 },
  csvHint: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: 'var(--gray-500)',
    background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
    borderRadius: 8, padding: '7px 12px', marginTop: 8,
  },
  teamCardHeader: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 18px', cursor: 'pointer',
    userSelect: 'none',
  },
  teamIcon: {
    width: 36, height: 36, borderRadius: 10,
    background: 'var(--blue-50)', color: 'var(--blue-600)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  membersSection: {
    borderTop: '1px solid var(--gray-100)',
    padding: '14px 18px',
    background: 'var(--gray-50)',
  },
  memberRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '7px 0',
    borderBottom: '1px solid var(--gray-100)',
  },
  memberMeta: { fontSize: 12, color: 'var(--gray-400)' },
  addMemberForm: {
    display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap',
  },
}