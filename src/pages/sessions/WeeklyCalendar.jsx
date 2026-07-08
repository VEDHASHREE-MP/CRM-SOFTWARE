import { ChevronLeft, ChevronRight } from 'lucide-react'

const STATUS_COLORS = {
  Scheduled: { bg: '#dbeafe', color: '#1d4ed8', dot: '#3b82f6' },
  Completed: { bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
  Cancelled: { bg: '#f1f5f9', color: '#64748b', dot: '#94a3b8' }
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekDays(weekStart) {
  const days = []
  const start = new Date(weekStart)
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return days
}

function fmt(dateObj) {
  return dateObj.toISOString().slice(0, 10)
}

function fmtDisplay(dateObj) {
  return dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function fmt12h(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}

export default function WeeklyCalendar({ weekStart, sessions, onPrevWeek, onNextWeek, onSessionClick }) {
  const days = getWeekDays(weekStart)
  const today = new Date().toISOString().slice(0, 10)

  const sessionsByDay = {}
  days.forEach(d => { sessionsByDay[fmt(d)] = [] })
  sessions.forEach(s => {
    if (sessionsByDay[s.session_date] !== undefined) {
      sessionsByDay[s.session_date].push(s)
    }
  })

  const weekLabel = () => {
    const start = days[0]
    const end = days[6]
    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`
    }
    return `${start.toLocaleDateString('en-IN', { month: 'short' })} – ${end.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Calendar header */}
      <div style={styles.calHeader}>
        <button className="btn btn-ghost btn-sm" onClick={onPrevWeek}>
          <ChevronLeft size={16} />
        </button>
        <div style={styles.weekLabel}>{weekLabel()}</div>
        <button className="btn btn-ghost btn-sm" onClick={onNextWeek}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day columns */}
      <div style={styles.grid}>
        {days.map((day, i) => {
          const dateKey = fmt(day)
          const isToday = dateKey === today
          const daySessions = sessionsByDay[dateKey] || []

          return (
            <div key={dateKey} style={{
              ...styles.dayCol,
              ...(i < 6 ? { borderRight: '1px solid var(--gray-100)' } : {}),
              ...(isToday ? { background: 'var(--blue-50)' } : {})
            }}>
              {/* Day header */}
              <div style={styles.dayHeader}>
                <div style={{ ...styles.dayName, ...(isToday ? { color: 'var(--blue-600)' } : {}) }}>
                  {DAY_NAMES[i]}
                </div>
                <div style={{
                  ...styles.dayNum,
                  ...(isToday ? styles.dayNumToday : {})
                }}>
                  {day.getDate()}
                </div>
              </div>

              {/* Sessions */}
              <div style={styles.sessionsArea}>
                {daySessions.length === 0 ? (
                  <div style={styles.emptyDay} />
                ) : (
                  daySessions.map(s => {
                    const colors = STATUS_COLORS[s.status] || STATUS_COLORS.Scheduled
                    return (
                      <div
                        key={s.id}
                        onClick={() => onSessionClick(s)}
                        style={{
                          ...styles.sessionCard,
                          background: colors.bg,
                          borderLeft: `3px solid ${colors.dot}`,
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ ...styles.sessionTime, color: colors.color }}>
                          {fmt12h(s.session_time)}
                        </div>
                        <div style={styles.sessionName}>{s.customer_name}</div>
                        <div style={{ ...styles.sessionService, color: colors.color }}>
                          {s.service}
                        </div>
                        {s.duration && (
                          <div style={styles.sessionDuration}>⏱ {s.duration}</div>
                        )}
                        {s.staff_name && (
                          <div style={styles.sessionStaff}>👤 {s.staff_name}</div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        {Object.entries(STATUS_COLORS).map(([status, colors]) => (
          <div key={status} style={styles.legendItem}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.dot }} />
            <span>{status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  calHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px',
    borderBottom: '1px solid var(--gray-100)'
  },
  weekLabel: {
    fontFamily: 'var(--font-head)', fontWeight: 700,
    fontSize: 15, color: 'var(--gray-900)'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    minHeight: 300
  },
  dayCol: {
    display: 'flex', flexDirection: 'column'
  },
  dayHeader: {
    padding: '10px 8px 8px',
    textAlign: 'center',
    borderBottom: '1px solid var(--gray-100)'
  },
  dayName: {
    fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
    textTransform: 'uppercase', color: 'var(--gray-400)', marginBottom: 4
  },
  dayNum: {
    width: 28, height: 28, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto',
    fontSize: 14, fontWeight: 600, color: 'var(--gray-700)'
  },
  dayNumToday: {
    background: 'var(--blue-600)', color: '#fff'
  },
  sessionsArea: {
    flex: 1, padding: '8px 6px',
    display: 'flex', flexDirection: 'column', gap: 5
  },
  emptyDay: { flex: 1, minHeight: 80 },
  sessionCard: {
    borderRadius: 6, padding: '6px 8px',
    transition: 'opacity 150ms',
    fontSize: 11
  },
  sessionTime: {
    fontWeight: 700, fontSize: 11, marginBottom: 2
  },
  sessionName: {
    fontWeight: 600, fontSize: 12, color: 'var(--gray-800)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
  },
  sessionService: {
    fontSize: 11, marginTop: 1,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
  },
  sessionDuration: {
    fontSize: 10, color: 'var(--gray-500)', marginTop: 2
  },
  sessionStaff: {
    fontSize: 10, color: 'var(--gray-500)', marginTop: 1,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
  },
  legend: {
    display: 'flex', gap: 16, padding: '10px 20px',
    borderTop: '1px solid var(--gray-100)'
  },
  legendItem: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: 'var(--gray-500)', fontWeight: 500
  }
}
