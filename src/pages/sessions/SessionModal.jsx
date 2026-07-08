import { useState, useEffect } from 'react'
import { X, UserCheck, UserPlus, Users } from 'lucide-react'
import api from '../../api/axios'
import { useToast } from '../../context/ToastContext'

const DURATION_PRESETS = ['30 mins', '1 hour', '1.5 hours', '2 hours', '3 hours', 'Custom']
const STATUSES = ['Scheduled', 'Completed', 'Cancelled']

const EMPTY = {
  enquiry_id: '', team_id: '', customer_name: '', phone: '', service: '',
  session_date: '', session_time: '', duration: '', duration_custom: '',
  mode: 'offline', location_or_link: '', notes: '', assigned_staff: '', status: 'Scheduled',
}

// bookingMode: 'enquiry' | 'direct' | 'team'

export default function SessionModal({ open, onClose, onSaved, editData }) {
  const { addToast } = useToast()
  const [bookingMode, setBookingMode]             = useState('enquiry')
  const [form, setForm]                           = useState(EMPTY)
  const [convertedEnquiries, setConvertedEnquiries] = useState([])
  const [convertedTeams, setConvertedTeams]       = useState([])
  const [staffList, setStaffList]                 = useState([])
  const [isCustomDuration, setIsCustomDuration]   = useState(false)
  const [loading, setLoading]                     = useState(false)
  const [errors, setErrors]                       = useState({})
  // team member selection
  const [selectedTeamMembers, setSelectedTeamMembers] = useState([]) // member ids
  const [teamMembers, setTeamMembers]             = useState([])      // full member objects

  useEffect(() => {
    if (!open) return
    api.get('/sessions/converted-enquiries').then(r => setConvertedEnquiries(r.data)).catch(() => {})
    api.get('/team-enquiries/converted').then(r => setConvertedTeams(r.data)).catch(() => {})
    api.get('/team/members').then(r => setStaffList(r.data)).catch(() => {})
  }, [open])

  useEffect(() => {
    if (editData) {
      const isCustom = !DURATION_PRESETS.slice(0, -1).includes(editData.duration)
      let mode = 'direct'
      if (editData.enquiry_id) mode = 'enquiry'
      else if (editData.team_id) mode = 'team'
      setBookingMode(mode)
      setIsCustomDuration(isCustom)
      setForm({
        enquiry_id:       editData.enquiry_id || '',
        team_id:          editData.team_id    || '',
        customer_name:    editData.customer_name || '',
        phone:            editData.phone || '',
        service:          editData.service || '',
        session_date:     editData.session_date || '',
        session_time:     editData.session_time || '',
        duration:         isCustom ? 'Custom' : (editData.duration || ''),
        duration_custom:  isCustom ? editData.duration : '',
        mode:             editData.mode || 'offline',
        location_or_link: editData.location_or_link || '',
        notes:            editData.notes || '',
        assigned_staff:   editData.assigned_staff || '',
        status:           editData.status || 'Scheduled',
      })
    } else {
      setForm(EMPTY)
      setBookingMode('enquiry')
      setIsCustomDuration(false)
      setSelectedTeamMembers([])
      setTeamMembers([])
    }
    setErrors({})
  }, [editData, open])

  // When a team is selected, load its members
  useEffect(() => {
    if (form.team_id) {
      const team = convertedTeams.find(t => t.id === parseInt(form.team_id))
      if (team) {
        setTeamMembers(team.members || [])
        setSelectedTeamMembers((team.members || []).map(m => m.id)) // default: all selected
      }
    } else {
      setTeamMembers([])
      setSelectedTeamMembers([])
    }
  }, [form.team_id, convertedTeams])

  const handleModeSwitch = (mode) => {
    setBookingMode(mode)
    setForm(f => ({ ...f, enquiry_id: '', team_id: '', customer_name: '', phone: '', service: '' }))
    setSelectedTeamMembers([])
    setTeamMembers([])
    setErrors({})
  }

  const handleEnquirySelect = (e) => {
    const id      = e.target.value
    const enquiry = convertedEnquiries.find(eq => eq.id === parseInt(id))
    if (enquiry) {
      setForm(f => ({ ...f, enquiry_id: id, customer_name: enquiry.name, phone: enquiry.phone, service: enquiry.service }))
    } else {
      setForm(f => ({ ...f, enquiry_id: '', customer_name: '', phone: '', service: '' }))
    }
  }

  const handleTeamSelect = (e) => {
    const id   = e.target.value
    const team = convertedTeams.find(t => t.id === parseInt(id))
    if (team) {
      setForm(f => ({ ...f, team_id: id, customer_name: team.team_name, phone: 'Team', service: team.service }))
    } else {
      setForm(f => ({ ...f, team_id: '', customer_name: '', phone: '', service: '' }))
    }
  }

  const toggleMember = (id) => {
    setSelectedTeamMembers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleDurationChange = (val) => {
    setIsCustomDuration(val === 'Custom')
    setForm(f => ({ ...f, duration: val, duration_custom: '' }))
  }

  const validate = () => {
    const e = {}
    if (bookingMode === 'enquiry') {
      if (!form.enquiry_id) e.enquiry_id = 'Please select a converted enquiry'
    } else if (bookingMode === 'team') {
      if (!form.team_id) e.team_id = 'Please select a converted team'
      if (selectedTeamMembers.length === 0) e.members = 'Select at least one member'
    } else {
      if (!form.customer_name.trim()) e.customer_name = 'Required'
      if (!form.phone.trim())         e.phone         = 'Required'
      if (!form.service.trim())       e.service       = 'Required'
    }
    if (!form.session_date) e.session_date = 'Required'
    if (!form.session_time) e.session_time = 'Required'
    if (!form.duration)     e.duration     = 'Required'
    if (isCustomDuration && !form.duration_custom.trim()) e.duration_custom = 'Enter custom duration'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        ...form,
        duration:         isCustomDuration ? form.duration_custom : form.duration,
        enquiry_id:       bookingMode === 'enquiry' ? (form.enquiry_id || null) : null,
        team_id:          bookingMode === 'team'    ? (form.team_id    || null) : null,
        member_ids:       bookingMode === 'team'    ? selectedTeamMembers       : [],
        assigned_staff:   form.assigned_staff   || null,
        location_or_link: form.location_or_link || null,
        notes:            form.notes            || null,
      }
      delete payload.duration_custom

      if (editData) {
        await api.put(`/sessions/${editData.id}`, payload)
        addToast('Session updated successfully', 'success', '✅ Saved')
      } else {
        await api.post('/sessions/', payload)
        addToast('Session booked successfully', 'success', '✅ Booked')
      }
      onSaved()
      onClose()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save session', 'error', '❌ Error')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const err = (key) => errors[key] && (
    <span style={{ fontSize: 12, color: 'var(--red-500)', marginTop: 3, display: 'block' }}>{errors[key]}</span>
  )
  const inputStyle = (key) => errors[key] ? { borderColor: 'var(--red-500)' } : {}

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h2 className="modal-title">{editData ? 'Edit Session' : 'Book New Session'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Booking type toggle (create only) ───────────────────── */}
          {!editData && (
            <div style={styles.toggleWrap}>
              <button type="button"
                style={{ ...styles.toggleBtn, ...(bookingMode === 'enquiry' ? styles.toggleBtnActive : {}) }}
                onClick={() => handleModeSwitch('enquiry')}>
                <UserCheck size={14} /> Converted Enquiry
              </button>
              <button type="button"
                style={{ ...styles.toggleBtn, ...(bookingMode === 'direct' ? styles.toggleBtnActive : {}) }}
                onClick={() => handleModeSwitch('direct')}>
                <UserPlus size={14} /> Walk-in / Direct
              </button>
              <button type="button"
                style={{ ...styles.toggleBtn, ...(bookingMode === 'team' ? styles.toggleBtnActive : {}) }}
                onClick={() => handleModeSwitch('team')}>
                <Users size={14} /> Team
              </button>
            </div>
          )}

          {/* ── Enquiry mode ──────────────────────────────────────────── */}
          {bookingMode === 'enquiry' && (
            <div className="form-group">
              <label className="form-label">Converted Enquiry *</label>
              <select className="form-input" value={form.enquiry_id} onChange={handleEnquirySelect}
                disabled={!!editData}
                style={{ ...(editData ? { background: 'var(--gray-50)', cursor: 'not-allowed' } : {}), ...inputStyle('enquiry_id') }}>
                <option value="">— Select a converted enquiry —</option>
                {convertedEnquiries.map(eq => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name} · {eq.phone} · {eq.service}
                    {eq.session_count > 0 ? ` (${eq.session_count} session${eq.session_count > 1 ? 's' : ''})` : ''}
                  </option>
                ))}
              </select>
              {err('enquiry_id')}
              {convertedEnquiries.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--amber-500)', marginTop: 4, display: 'block' }}>
                  ⚠️ No converted enquiries found. Mark an enquiry as "Converted" first.
                </span>
              )}
              {form.customer_name && (
                <div style={styles.autoFilled}>
                  <span>👤 <strong>{form.customer_name}</strong></span>
                  <span>📞 {form.phone}</span>
                  <span>🛠 {form.service}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Direct / walk-in mode ─────────────────────────────────── */}
          {bookingMode === 'direct' && (
            <div style={{ background: 'var(--amber-50)', border: '1.5px solid #fcd34d', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 2 }}>
                👤 Enter customer details manually
              </div>
              <div style={styles.grid3}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Customer Name *</label>
                  <input className="form-input" placeholder="Full name" value={form.customer_name}
                    onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    style={inputStyle('customer_name')} />
                  {err('customer_name')}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Phone *</label>
                  <input className="form-input" placeholder="Phone number" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    style={inputStyle('phone')} />
                  {err('phone')}
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Service *</label>
                  <input className="form-input" placeholder="e.g. Web Development" value={form.service}
                    onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
                    style={inputStyle('service')} />
                  {err('service')}
                </div>
              </div>
            </div>
          )}

          {/* ── Team mode ─────────────────────────────────────────────── */}
          {bookingMode === 'team' && (
            <div style={{ background: 'var(--blue-50)', border: '1.5px solid var(--blue-200)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue-800)', marginBottom: 2 }}>
                👥 Select a converted team
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Team *</label>
                <select className="form-input" value={form.team_id} onChange={handleTeamSelect}
                  style={inputStyle('team_id')}>
                  <option value="">— Select a converted team —</option>
                  {convertedTeams.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.team_name} · {t.service} ({t.member_count} member{t.member_count !== 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
                {err('team_id')}
                {convertedTeams.length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--amber-500)', marginTop: 4, display: 'block' }}>
                    ⚠️ No converted teams. Mark a team enquiry as "Converted" first.
                  </span>
                )}
              </div>

              {/* Member checklist */}
              {teamMembers.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue-700)', marginBottom: 8 }}>
                    Select attending members ({selectedTeamMembers.length}/{teamMembers.length})
                  </div>
                  {err('members')}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {teamMembers.map(m => (
                      <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, background: selectedTeamMembers.includes(m.id) ? '#dbeafe' : 'white', border: '1px solid', borderColor: selectedTeamMembers.includes(m.id) ? 'var(--blue-300)' : 'var(--gray-200)', transition: 'all 150ms' }}>
                        <input type="checkbox" checked={selectedTeamMembers.includes(m.id)} onChange={() => toggleMember(m.id)} />
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{m.name}</span>
                        {m.phone && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{m.phone}</span>}
                        {m.email && <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{m.email}</span>}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
                      onClick={() => setSelectedTeamMembers(teamMembers.map(m => m.id))}>
                      Select All
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
                      onClick={() => setSelectedTeamMembers([])}>
                      Deselect All
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Edit mode read-only info */}
          {editData && bookingMode === 'direct' && form.customer_name && (
            <div style={styles.autoFilled}>
              <span>👤 <strong>{form.customer_name}</strong></span>
              <span>📞 {form.phone}</span>
              <span>🛠 {form.service}</span>
            </div>
          )}

          {/* ── Date & Time ──────────────────────────────────────────── */}
          <div style={styles.grid2}>
            <div className="form-group">
              <label className="form-label">Session Date *</label>
              <input type="date" className="form-input" value={form.session_date}
                onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))}
                style={inputStyle('session_date')} />
              {err('session_date')}
            </div>
            <div className="form-group">
              <label className="form-label">Session Time *</label>
              <input type="time" className="form-input" value={form.session_time}
                onChange={e => setForm(f => ({ ...f, session_time: e.target.value }))}
                style={inputStyle('session_time')} />
              {err('session_time')}
            </div>
          </div>

          {/* ── Duration ─────────────────────────────────────────────── */}
          <div className="form-group">
            <label className="form-label">Duration *</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {DURATION_PRESETS.map(d => (
                <button key={d} type="button" onClick={() => handleDurationChange(d)}
                  style={{ ...styles.durationBtn, ...(form.duration === d ? styles.durationBtnActive : {}) }}>
                  {d}
                </button>
              ))}
            </div>
            {isCustomDuration && (
              <input className="form-input" style={{ marginTop: 8, maxWidth: 200, ...inputStyle('duration_custom') }}
                placeholder="e.g. 45 mins, 2.5 hours"
                value={form.duration_custom}
                onChange={e => setForm(f => ({ ...f, duration_custom: e.target.value }))} />
            )}
            {err('duration')}
            {err('duration_custom')}
          </div>

          {/* ── Mode & Staff ─────────────────────────────────────────── */}
          <div style={styles.grid2}>
            <div className="form-group">
              <label className="form-label">Mode</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['offline', 'online'].map(m => (
                  <button key={m} type="button" onClick={() => setForm(f => ({ ...f, mode: m }))}
                    style={{ ...styles.modeBtn, ...(form.mode === m ? styles.modeBtnActive : {}) }}>
                    {m === 'offline' ? '🏢 Offline' : '💻 Online'}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Assign Staff</label>
              <select className="form-input" value={form.assigned_staff}
                onChange={e => setForm(f => ({ ...f, assigned_staff: e.target.value }))}>
                <option value="">— Unassigned —</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
              </select>
            </div>
          </div>

          {/* ── Location ─────────────────────────────────────────────── */}
          <div className="form-group">
            <label className="form-label">{form.mode === 'online' ? 'Meeting Link' : 'Location / Address'}</label>
            <input className="form-input"
              placeholder={form.mode === 'online' ? 'https://meet.google.com/...' : 'Office address or venue'}
              value={form.location_or_link}
              onChange={e => setForm(f => ({ ...f, location_or_link: e.target.value }))} />
          </div>

          {/* ── Status (edit only) ───────────────────────────────────── */}
          {editData && (
            <div className="form-group">
              <label className="form-label">Status</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {STATUSES.map(s => (
                  <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                    style={{ ...styles.statusBtn, ...(form.status === s ? styles.statusBtnActive[s] : {}) }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Notes ────────────────────────────────────────────────── */}
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input" placeholder="Any notes for this session..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : editData ? 'Save Changes' : 'Book Session'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
  autoFilled: {
    display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 10,
    background: 'var(--blue-50)', border: '1px solid var(--blue-200)',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--blue-800)',
  },
  toggleWrap: {
    display: 'flex', gap: 0, border: '1.5px solid var(--gray-200)',
    borderRadius: 10, overflow: 'hidden', background: 'var(--gray-50)',
  },
  toggleBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 7, padding: '9px 12px', fontSize: 13, fontWeight: 600,
    border: 'none', cursor: 'pointer',
    background: 'transparent', color: 'var(--gray-500)', transition: 'all 150ms',
  },
  toggleBtnActive: { background: '#fff', color: 'var(--blue-700)', boxShadow: '0 1px 4px rgba(0,0,0,.08)' },
  durationBtn: {
    padding: '6px 14px', borderRadius: 99, fontSize: 13, fontWeight: 500,
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--gray-200)',
    background: '#fff', color: 'var(--gray-600)', cursor: 'pointer', transition: 'all 150ms',
  },
  durationBtnActive: { background: 'var(--blue-600)', color: '#fff', borderColor: 'var(--blue-600)' },
  modeBtn: {
    flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--gray-200)',
    background: '#fff', color: 'var(--gray-600)', cursor: 'pointer', transition: 'all 150ms',
  },
  modeBtnActive: { background: 'var(--blue-50)', color: 'var(--blue-700)', borderColor: 'var(--blue-400)' },
  statusBtn: {
    padding: '6px 14px', borderRadius: 99, fontSize: 13, fontWeight: 500,
    borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--gray-200)',
    background: '#fff', color: 'var(--gray-600)', cursor: 'pointer', transition: 'all 150ms',
  },
  statusBtnActive: {
    Scheduled: { background: 'var(--blue-50)',  color: 'var(--blue-700)',  borderColor: 'var(--blue-400)' },
    Completed: { background: 'var(--green-50)', color: 'var(--green-600)', borderColor: '#86efac' },
    Cancelled: { background: 'var(--gray-100)', color: 'var(--gray-500)',  borderColor: 'var(--gray-300)' },
  },
}