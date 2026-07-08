import { useState, useEffect } from 'react'
import {
  UserCheck, UserX, Pencil, X,
  ChevronDown, ChevronRight, Users, Trash2, UserPlus, FolderPlus
} from 'lucide-react'
import api from '../../api/axios'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'

export default function TeamPage() {
  const { addToast } = useToast()
  const { user: currentUser } = useAuth()

  const [teams, setTeams]                 = useState([])
  const [teamsLoading, setTeamsLoading]   = useState(true)
  const [expandedTeams, setExpandedTeams] = useState({})
  const [allUsers, setAllUsers]           = useState([])

  // Modals
  const [teamModal, setTeamModal]         = useState(false)   // create/rename team
  const [editTeam, setEditTeam]           = useState(null)    // team being renamed
  const [memberModal, setMemberModal]     = useState(false)   // create/edit user
  const [editMemberData, setEditMemberData] = useState(null)
  const [addToTeamModal, setAddToTeamModal] = useState(null)  // team_id
  const [deleteTeamId, setDeleteTeamId]   = useState(null)

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchTeams = async () => {
    setTeamsLoading(true)
    try {
      const res = await api.get('/team/')
      setTeams(res.data)
      setExpandedTeams(prev => {
        const next = { ...prev }
        res.data.forEach(t => { if (!(t.id in next)) next[t.id] = true })
        return next
      })
    } catch {
      addToast('Failed to load teams', 'error', '❌ Error')
    } finally {
      setTeamsLoading(false)
    }
  }

  const fetchAllUsers = async () => {
    try {
      const res = await api.get('/team/members/all')
      setAllUsers(res.data)
    } catch {}
  }

  useEffect(() => { fetchTeams(); fetchAllUsers() }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const toggleExpand = (id) =>
    setExpandedTeams(prev => ({ ...prev, [id]: !prev[id] }))

  const handleDeleteTeam = async () => {
    try {
      await api.delete(`/team/${deleteTeamId}`)
      addToast('Team deleted', 'success', '✅ Done')
      setDeleteTeamId(null)
      fetchTeams()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error', '❌ Error')
    }
  }

  const handleRemoveMember = async (teamId, userId, userName) => {
    try {
      await api.delete(`/team/${teamId}/members/${userId}`)
      addToast(`${userName} removed from team`, 'success', '✅ Done')
      fetchTeams()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error', '❌ Error')
    }
  }

  const handleToggleUser = async (id, name, isActive) => {
    try {
      await api.patch(`/team/members/${id}/toggle`)
      addToast(`${name} ${isActive ? 'deactivated' : 'activated'}`, 'success', '✅ Done')
      fetchTeams(); fetchAllUsers()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error', '❌ Error')
    }
  }

  const uniqueMemberCount = new Set(teams.flatMap(t => t.members.map(m => m.id))).size

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Team Management</div>
          <div className="page-subtitle">
            {teams.length} team{teams.length !== 1 ? 's' : ''} · {uniqueMemberCount} unique member{uniqueMemberCount !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => { setEditMemberData(null); setMemberModal(true) }}>
            <UserPlus size={16} /> Add Member
          </button>
          <button className="btn btn-primary" onClick={() => { setEditTeam(null); setTeamModal(true) }}>
            <FolderPlus size={16} /> Add Team
          </button>
        </div>
      </div>

      {teamsLoading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : teams.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">No teams yet</div>
            <div className="empty-state-desc">Create your first team to start organising members</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {teams.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              expanded={!!expandedTeams[team.id]}
              currentUserId={parseInt(currentUser?.id)}
              onToggleExpand={() => toggleExpand(team.id)}
              onRename={() => { setEditTeam(team); setTeamModal(true) }}
              onDelete={() => setDeleteTeamId(team.id)}
              onAddMember={() => setAddToTeamModal(team.id)}
              onRemoveMember={(uid, uname) => handleRemoveMember(team.id, uid, uname)}
              onEditMember={(m) => { setEditMemberData(m); setMemberModal(true) }}
              onToggleMember={handleToggleUser}
            />
          ))}
        </div>
      )}

      {/* Create / Rename Team */}
      <TeamModal
        open={teamModal}
        editTeam={editTeam}
        onClose={() => { setTeamModal(false); setEditTeam(null) }}
        onSaved={() => { fetchTeams(); setTeamModal(false); setEditTeam(null) }}
      />

      {/* Create / Edit user */}
      <MemberModal
        open={memberModal}
        editData={editMemberData}
        onClose={() => { setMemberModal(false); setEditMemberData(null) }}
        onSaved={() => { fetchTeams(); fetchAllUsers(); setMemberModal(false); setEditMemberData(null) }}
      />

      {/* Add existing user to team */}
      {addToTeamModal && (
        <AddToTeamModal
          teamId={addToTeamModal}
          allUsers={allUsers}
          currentTeamMembers={(teams.find(t => t.id === addToTeamModal)?.members || []).map(m => m.id)}
          onClose={() => setAddToTeamModal(null)}
          onSaved={() => { fetchTeams(); setAddToTeamModal(null) }}
        />
      )}

      {/* Confirm delete team */}
      {deleteTeamId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteTeamId(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Team</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTeamId(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 15, color: 'var(--gray-600)', lineHeight: 1.7 }}>
                Are you sure? Member accounts will <strong>not</strong> be deleted — only the team group is removed.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTeamId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteTeam}>Delete Team</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Team Card ─────────────────────────────────────────────────────────────────

function TeamCard({ team, expanded, currentUserId, onToggleExpand, onRename, onDelete, onAddMember, onRemoveMember, onEditMember, onToggleMember }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Team header row */}
      <div
        onClick={onToggleExpand}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 22px', cursor: 'pointer',
          background: 'var(--gray-50)',
          borderBottom: expanded ? '1px solid var(--gray-200)' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {expanded
            ? <ChevronDown size={18} color="var(--gray-400)" />
            : <ChevronRight size={18} color="var(--gray-400)" />
          }
          <div style={{
            width: 38, height: 38, borderRadius: 9,
            background: 'var(--blue-100)', color: 'var(--blue-700)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Users size={18} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 17, color: 'var(--gray-900)' }}>
              {team.name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 2 }}>
              {team.members.length} member{team.members.length !== 1 ? 's' : ''}
              {team.created_by_name ? ` · Created by ${team.created_by_name}` : ''}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
          <button className="btn btn-ghost btn-sm" onClick={onAddMember}>
            <UserPlus size={14} /> Add Member
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onRename} title="Rename">
            <Pencil size={14} />
          </button>
          <button className="btn btn-danger btn-sm" onClick={onDelete} title="Delete team">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Members table */}
      {expanded && (
        team.members.length === 0 ? (
          <div style={{ padding: '28px 22px', textAlign: 'center', color: 'var(--gray-400)', fontSize: 15 }}>
            No members yet. Click <strong>Add Member</strong> above to add someone.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {team.members.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                          background: m.role === 'admin' ? 'var(--blue-100)' : 'var(--gray-100)',
                          color: m.role === 'admin' ? 'var(--blue-700)' : 'var(--gray-500)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 14
                        }}>{m.name?.[0]?.toUpperCase()}</div>
                        <span style={{ fontWeight: 600, color: 'var(--gray-900)', fontSize: 15 }}>
                          {m.name}
                          {m.id === currentUserId && (
                            <span style={{ marginLeft: 7, fontSize: 12, background: 'var(--blue-100)', color: 'var(--blue-700)', padding: '2px 8px', borderRadius: 99 }}>You</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--gray-500)' }}>{m.email}</td>
                    <td>
                      <span className={`badge ${m.role === 'admin' ? 'badge-new' : 'badge-closed'}`}>
                        {m.role === 'admin' ? '⚡ Admin' : '👤 Staff'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${m.is_active ? 'badge-converted' : 'badge-closed'}`}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => onEditMember(m)} title="Edit user">
                          <Pencil size={14} />
                        </button>
                        {m.id !== currentUserId && (
                          <button
                            className={`btn btn-sm ${m.is_active ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => onToggleMember(m.id, m.name, m.is_active)}
                            title={m.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {m.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => onRemoveMember(m.id, m.name)}
                          title="Remove from this team"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

// ── Create / Rename Team Modal ────────────────────────────────────────────────

function TeamModal({ open, editTeam, onClose, onSaved }) {
  const { addToast } = useToast()
  const [name, setName]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => { setName(editTeam ? editTeam.name : ''); setError('') }, [editTeam, open])

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Team name is required'); return }
    setLoading(true)
    try {
      if (editTeam) {
        await api.put(`/team/${editTeam.id}`, { name })
        addToast('Team renamed', 'success', '✅ Saved')
      } else {
        await api.post('/team/create', { name })
        addToast('Team created', 'success', '✅ Created')
      }
      onSaved()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error', '❌ Error')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">{editTeam ? 'Rename Team' : 'Create New Team'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Team Name *</label>
            <input
              className="form-input"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="e.g. Sales Team, Support Team"
              style={error ? { borderColor: 'var(--red-500)' } : {}}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
            {error && <span style={{ fontSize: 13, color: 'var(--red-500)' }}>{error}</span>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : editTeam ? 'Save Changes' : 'Create Team'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Existing User to Team Modal ──────────────────────────────────────────

function AddToTeamModal({ teamId, allUsers, currentTeamMembers, onClose, onSaved }) {
  const { addToast } = useToast()
  const [selectedUserId, setSelectedUserId] = useState('')
  const [loading, setLoading]               = useState(false)

  const available = allUsers.filter(u => !currentTeamMembers.includes(u.id))

  const handleSubmit = async () => {
    if (!selectedUserId) return
    setLoading(true)
    try {
      await api.post(`/team/${teamId}/members`, { user_id: parseInt(selectedUserId) })
      addToast('Member added to team', 'success', '✅ Added')
      onSaved()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error', '❌ Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">Add Member to Team</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {available.length === 0 ? (
            <p style={{ fontSize: 15, color: 'var(--gray-500)', textAlign: 'center', padding: '12px 0' }}>
              All existing members are already in this team.<br />
              Use <strong>Add Member</strong> in the header to create a new user.
            </p>
          ) : (
            <div className="form-group">
              <label className="form-label">Select Member</label>
              <select className="form-input" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                <option value="">— Choose a member —</option>
                {available.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role}){!u.is_active ? ' · Inactive' : ''}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 4 }}>
                A member can belong to multiple teams.
              </span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {available.length > 0 && (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !selectedUserId}>
              {loading ? 'Adding...' : 'Add to Team'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Create / Edit User Modal ──────────────────────────────────────────────────

function MemberModal({ open, editData, onClose, onSaved }) {
  const { addToast } = useToast()
  const [form, setForm]       = useState({ name: '', email: '', password: '', role: 'staff' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})

  useEffect(() => {
    if (editData) {
      setForm({ name: editData.name, email: editData.email, password: '', role: editData.role })
    } else {
      setForm({ name: '', email: '', password: '', role: 'staff' })
    }
    setErrors({})
  }, [editData, open])

  const validate = () => {
    const e = {}
    if (!form.name.trim())  e.name  = 'Required'
    if (!form.email.trim()) e.email = 'Required'
    if (!editData && !form.password.trim()) e.password = 'Required'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      if (editData) {
        await api.put(`/team/members/${editData.id}`, form)
        addToast('Member updated', 'success', '✅ Saved')
      } else {
        await api.post('/team/members/add', form)
        addToast('Member created', 'success', '✅ Added')
      }
      onSaved()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error', '❌ Error')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2 className="modal-title">{editData ? 'Edit Member' : 'Add New Member'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="John Doe"
              style={errors.name ? { borderColor: 'var(--red-500)' } : {}} />
            {errors.name && <span style={{ fontSize: 13, color: 'var(--red-500)' }}>{errors.name}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="john@virtualtech.com"
              disabled={!!editData}
              style={{ ...(errors.email ? { borderColor: 'var(--red-500)' } : {}), ...(editData ? { background: 'var(--gray-50)', cursor: 'not-allowed' } : {}) }} />
            {errors.email && <span style={{ fontSize: 13, color: 'var(--red-500)' }}>{errors.email}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Password {editData ? '(leave blank to keep current)' : '*'}</label>
            <input className="form-input" type="password" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={editData ? '••••••••' : 'Set login password'}
              style={errors.password ? { borderColor: 'var(--red-500)' } : {}} />
            {errors.password && <span style={{ fontSize: 13, color: 'var(--red-500)' }}>{errors.password}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-input" value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : editData ? 'Save Changes' : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  )
}