import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('vtcrm_user')
    return stored ? JSON.parse(stored) : null
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('vtcrm_token')
    if (token) {
      api.get('/auth/me')
        .then(res => {
          setUser(res.data)
          localStorage.setItem('vtcrm_user', JSON.stringify(res.data))
        })
        .catch(() => {
          localStorage.removeItem('vtcrm_token')
          localStorage.removeItem('vtcrm_user')
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    localStorage.setItem('vtcrm_token', res.data.token)
    localStorage.setItem('vtcrm_user', JSON.stringify(res.data.user))
    setUser(res.data.user)
    return res.data.user
  }

  const logout = () => {
    localStorage.removeItem('vtcrm_token')
    localStorage.removeItem('vtcrm_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
