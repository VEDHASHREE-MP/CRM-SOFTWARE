import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import api from '../../api/axios'
import { useToast } from '../../context/ToastContext'

const STATUSES = ['New', 'Follow-up', 'Converted', 'Closed']

const EMPTY = {
  name: '', phone: '', service: '', source: '',
  status: 'New', notes: '', follow_up_date: '', assigned_to: ''
}

export default function EnquiryModal({ open, onClose, onSaved, editData }) {
  const { addToast } = useToast()
  const [form, setForm] = useState(EMPTY)
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    api.get('/team/members').then(r => setStaff(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (editData) {
      setForm({
        name: editData.name || '',
        phone: editData.phone || '',
        service: editData.service || '',
        source: editData.source || '',
        status: editData.status || 'New',
        notes: editData.notes || '',
        follow_up_date: editData.follow_up_date ? editData.follow_up_date.slice(0, 10) : '',
        assigned_to: editData.assigned_to || ''
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
  }, [editData, open])

  const validate = () => {
    const e = {}
    if (!form.name.trim())    e.name    = 'Name is required'
    if (!form.phone.trim())   e.phone   = 'Phone is required'
    if (!form.service.trim()) e.service = 'Service is required'
    if (!form.source.trim())  e.source  = 'Source is required'
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
        follow_up_date: form.follow_up_date || null
      }
      if (editData) {
        await api.put(`/enquiries/${editData.id}`, payload)
        addToast('Enquiry updated successfully', 'success', '✅ Saved')
      } else {
        await api.post('/enquiries/', payload)
        addToast('New enquiry added successfully', 'success', '✅ Added')
      }
      onSaved()
      onClose()
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save enquiry', 'error', '❌ Error')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const field = (key, label, type = 'text', placeholder = '') => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input
        type={type}
        className={`form-input ${errors[key] ? 'error' : ''}`}
        placeholder={placeholder}
        value={form[key]}
        onChange={e => { setForm(f => ({ ...f, [key]: e.target.value })); if (errors[key]) setErrors(ev => ({ ...ev, [key]: '' })) }}
        style={errors[key] ? { borderColor: 'var(--red-500)' } : {}}
      />
      {errors[key] && <span style={{ fontSize: 12, color: 'var(--red-500)' }}>{errors[key]}</span>}
    </div>
  )

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{editData ? 'Edit Enquiry' : 'Add New Enquiry'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div style={styles.grid2}>
            {field('name',  'Full Name *',      'text', 'Customer name')}
            {field('phone', 'Phone Number *',   'tel',  '9XXXXXXXXX')}
          </div>
          <div style={{ ...styles.grid2, marginTop: 14 }}>
            {field('service', 'Service *',  'text', 'e.g. Web Development, CCTV Installation')}
            {field('source',  'Source *',   'text', 'e.g. Instagram, Referral, Walk-in')}
          </div>

          <div style={{ ...styles.grid2, marginTop: 14 }}>
            {/* Status */}
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-input"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Assign to */}
            <div className="form-group">
              <label className="form-label">Assign To</label>
              <select
                className="form-input"
                value={form.assigned_to}
                onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
              >
                <option value="">— Unassigned —</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Follow-up date */}
          <div style={{ marginTop: 14 }}>
            <div className="form-group">
              <label className="form-label">Follow-up Date</label>
              <input
                type="date"
                className="form-input"
                value={form.follow_up_date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setForm(f => ({ ...f, follow_up_date: e.target.value }))}
                style={{ maxWidth: 220 }}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Notes</label>
            <textarea
              className="form-input"
              placeholder="Any additional notes about this enquiry..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : editData ? 'Save Changes' : 'Add Enquiry'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }
}
