import { useState, useEffect } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'

export default function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem('sit_session')
    if (saved) setUser(saved)
  }, [])

  const handleLogin = (username) => {
    localStorage.setItem('sit_session', username)
    setUser(username)
  }

  const handleLogout = () => {
    localStorage.removeItem('sit_session')
    setUser(null)
  }

  return user
    ? <Dashboard user={user} onLogout={handleLogout} />
    : <Login onLogin={handleLogin} />
}
