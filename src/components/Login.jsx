import { useState } from 'react'
import { validateLogin } from '../utils/auth'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) {
      setError('Username dan password wajib diisi.')
      return
    }
    setLoading(true)
    setTimeout(() => {
      if (validateLogin(username, password)) {
        onLogin(username.trim().toLowerCase())
      } else {
        setError('Username atau password tidak valid.')
        setLoading(false)
      }
    }, 300)
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
            <span className="text-white text-sm font-black tracking-tight">SIT</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">SMP NEGERI 82 JAKARTA</h1>
          <p className="text-slate-500 text-sm mt-1">Sistem Informasi Terpadu</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError('') }}
                className="input"
                placeholder="Masukkan username"
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                className="input"
                placeholder="Masukkan password"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-rose-500 text-xs bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition"
            >
              {loading ? 'Memuat...' : 'Masuk'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">© 2026 SIT Terpadu</p>
      </div>
    </div>
  )
}
