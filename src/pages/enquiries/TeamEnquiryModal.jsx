import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import api from '../../api/axios'
import { useToast } from '../../context/ToastContext'

const STATUSES = ['New', 'Follow-up', 'Converted', 'Closed']

const EMPTY_FORM = {
  team_name: '', service: '', source: '', notes: '', status: 'New', assigned_to: ''
}
const EMPTY_MEMBER = { name: '', phone: '', email: '' }

export default function TeamEnquiryModal({ open, onClose, onSaved, editData }) {
  const { addToast } = useToast()
  const [form, setForm]       = useState(EMPTY_FORM)
  const [members, setMembers] = useState([{ ...EMPTY_MEMBER }])
  const [staff, setStaff]     = useState([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState({})

  useEffect(() => {
    api.get('/team/members').then(r => setStaff(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (editData) {
      setForm({
        team_name:   editData.team_name   || '',
        service:     editData.service     || '',
        source:      editData.source      || '',
        notes:       editData.notes       || '',
        status:      editData.status      || 'New',
        assigned_to: editData.assigned_to || '',
      })
      setMembers(
        editData.members && editData.members.length > 0
          ? editData.members.map(m => ({ name: m.name || '', phone: m.phone || '', email: m.email || '' }))
          : [{ ...EMPTY_MEMBER }]
      )
    } else {
      setForm(EMPTY_FORM)
      setMembers([{ ...EMPTY_MEMBER }])
    }
    setErrors({})
  }, [editData, open])

  const updateMember = (idx, field, value) => {
    setMembers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))
  }
  const addMemberRow = () => setMembers(prev => [...prev, { ...EMPTY_MEMBER }])
  const removeMemberRow = (idx) => {
    if (members.length === 1) return
    setMembers(prev => prev.filter((_, i) => i !== idx))
  }

  const validate = () => {
    const e = {}
    if (!form.team_name.trim()) e.team_name = 'Team name is required'
    if (!form.service.trim())   e.service   = 'Service is required'
    if (members.filter(m => m.name.trim()).length === 0) e.members = 'At least one member with a name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        ...form,
        assigned_to: form.assigned_to || null,
        members: members.filter(m => m.name.trim()),
      }

      if (editData) {
        // Update team fields only (member changes are handled inline in TeamCard)
        await api.put(`/team-enquiries/${editData.id}`, payload)
        addToast('Team updated', 'success', '✅ Saved')
      } else {
        await api.post('/team-enquiries/', payload)
        addToast('Team created', 'success', '✅ Created')
      }
      onSaved()
      onClose()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save team', 'error', '❌ Error')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const err = (key) => errors[key] && (
    <span style={{ fontSize: 12, color: 'var(--red-500)', marginTop: 3, display: 'block' }}>{errors[key]}</span>
  )

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h2 className="modal-title">{editData ? 'Edit Team' : 'Add Team Enquiry'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Team name + service */}
          <div style={styles.grid2}>
            <div className="form-group">
              <label className="form-label">Team Name *</label>
              <input className="form-input" placeholder="e.g. ABC Corp, Batch 12"
                value={form.team_name}
                onChange={e => setForm(f => ({ ...f, team_name: e.target.value }))}
                style={errors.team_name ? { borderColor: 'var(--red-500)' } : {}}
              />
              {err('team_name')}
            </div>
            <div className="form-group">
              <label className="form-label">Service *</label>
              <input className="form-input" placeholder="e.g. Corporate Training"
                value={form.service}
                onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
                style={errors.service ? { borderColor: 'var(--red-500)' } : {}}
              />
              {err('service')}
            </div>
          </div>

          <div style={styles.grid2}>
            <div className="form-group">
              <label className="form-label">Source</label>
              <input className="form-input" placeholder="e.g. Google Form, Referral"
                value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Assign To</label>
            <select className="form-input" value={form.assigned_to}
              onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
              <option value="">— Unassigned —</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input" placeholder="Any notes about this team enquiry..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          {/* Members section — only shown when creating */}
          {!editData && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0 }}>Team Members *</label>
                <button className="btn btn-ghost btn-sm" onClick={addMemberRow} style={{ fontSize: 12, color: 'var(--blue-600)' }}>
                  <Plus size={13} /> Add Row
                </button>
              </div>
              {err('members')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {members.map((m, idx) => (
                  <div key={idx} style={styles.memberRow}>
                    <input className="form-input" placeholder="Name *" style={{ flex: 1.5 }}
                      value={m.name} onChange={e => updateMember(idx, 'name', e.target.value)} />
                    <input className="form-input" placeholder="Phone" style={{ flex: 1 }}
                      value={m.phone} onChange={e => updateMember(idx, 'phone', e.target.value)} />
                    <input className="form-input" placeholder="Email" style={{ flex: 1.5 }}
                      value={m.email} onChange={e => updateMember(idx, 'email', e.target.value)} />
                    <button className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--red-400)', flexShrink: 0 }}
                      onClick={() => removeMemberRow(idx)}
                      disabled={members.length === 1}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 6 }}>
                {members.filter(m => m.name.trim()).length} member{members.filter(m => m.name.trim()).length !== 1 ? 's' : ''} ready to add
              </div>
            </div>
          )}

          {editData && (
            <div style={{ fontSize: 12, color: 'var(--gray-400)', background: 'var(--gray-50)', padding: '10px 12px', borderRadius: 8 }}>
              ℹ️ To add or remove individual members, use the expand button on the team card.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : editData ? 'Save Changes' : 'Create Team'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  memberRow: { display: 'flex', gap: 8, alignItems: 'center' },
}
