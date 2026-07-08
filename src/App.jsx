import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import EnquiriesPage from './pages/enquiries/EnquiriesPage'
import SessionsPage from './pages/sessions/SessionsPage'
import TeamPage from './pages/team/TeamPage'
import BillingPage from './pages/billing/BillingPage'
import CustomersPage from './pages/customers/CustomersPage'
import ComingSoon from './pages/ComingSoon'
import ReportsPage from './pages/reports/ReportsPage'
import InventoryPage from './pages/inventory/InventoryPage'
import ExpensesPage from './pages/expenses/ExpensesPage'
function PrivateRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/" element={<Navigate to="/dashboard" />} />

      <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="/dashboard"  element={<Dashboard />} />
        <Route path="/enquiries"  element={<EnquiriesPage />} />
        <Route path="/sessions"   element={<SessionsPage />} />
        <Route path="/team"       element={<PrivateRoute adminOnly><TeamPage /></PrivateRoute>} />
        <Route path="/billing"    element={<PrivateRoute adminOnly><BillingPage /></PrivateRoute>} />
        <Route path="/customers"  element={<PrivateRoute adminOnly><CustomersPage /></PrivateRoute>} />
        <Route path="/reports"    element={<ReportsPage />} />
        <Route path="/inventory"  element={<PrivateRoute adminOnly><InventoryPage /></PrivateRoute>} />
        <Route path="/expenses"   element={<PrivateRoute adminOnly><ExpensesPage /></PrivateRoute>} />
        <Route path="/settings"   element={<ComingSoon module="Settings" />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}