export default function ComingSoon({ module = 'This module' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', gap: 16, textAlign: 'center'
    }}>
      <div style={{ fontSize: 56 }}>🚧</div>
      <div style={{ fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 700, color: 'var(--gray-800)' }}>
        Coming Soon
      </div>
      <div style={{ fontSize: 14, color: 'var(--gray-400)', maxWidth: 340 }}>
        <strong>{module}</strong> is under development and will be available in the next release.
      </div>
      <div style={{
        background: 'var(--blue-50)', border: '1px solid var(--blue-200)',
        borderRadius: 8, padding: '10px 20px',
        fontSize: 13, color: 'var(--blue-700)', fontWeight: 500
      }}>
        Module-by-module rollout in progress
      </div>
    </div>
  )
}
