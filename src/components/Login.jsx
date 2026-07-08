import { useState } from 'react'
import { validateLogin } from '../utils/auth'

// Sesuaikan relative path ini jika posisi file komponen Anda berbeda.
// Karena gambar ada di src/BG.jpeg, jika file ini ada di src/components/, gunakan '../BG.jpeg'
import bgImage from '../BG.jpeg' 

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
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* OVERLAY: Gradasi gelap transparan untuk memperjelas form di depan gambar */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/80 via-slate-900/70 to-black/90 backdrop-blur-[2px]"></div>

      {/* CONTAINER UTAMA */}
      <div className="relative z-10 w-full max-w-md">
        
        {/* FORM CARD: Efek Glassmorphism (Kaca) dengan Gradasi */}
        <div className="bg-gradient-to-br from-white/90 via-white/80 to-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white/50 p-8 sm:p-10">
          
          {/* HEADER SECTION */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-2xl shadow-lg shadow-indigo-500/30 mb-5">
              <span className="text-white text-lg font-black tracking-widest">SIT</span>
            </div>
            {/* Teks menggunakan efek gradasi */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-indigo-800 mb-1">
              SMPN 82 JAKARTA
            </h1>
            <p className="text-indigo-600 font-medium text-sm tracking-wide">
              Sistem Informasi Terpadu
            </p>
          </div>

          {/* FORM INPUT SECTION */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError('') }}
                className="w-full px-4 py-3 bg-white/60 border border-white/50 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/20 rounded-xl outline-none transition-all duration-300 text-slate-700 placeholder-slate-400 font-medium shadow-inner"
                placeholder="Masukkan username"
                autoComplete="username"
                autoFocus
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                className="w-full px-4 py-3 bg-white/60 border border-white/50 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/20 rounded-xl outline-none transition-all duration-300 text-slate-700 placeholder-slate-400 font-medium shadow-inner"
                placeholder="Masukkan password"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-rose-50/90 backdrop-blur-sm border border-rose-200 text-rose-600 px-4 py-3 rounded-xl animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 disabled:opacity-70 disabled:cursor-not-allowed text-white font-bold text-sm tracking-wide py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Memuat...
                </span>
              ) : 'Masuk'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-white/50 font-medium mt-8 tracking-wide drop-shadow-md">
          © 2026 SIT Terpadu • SMP Negeri 82 Jakarta
        </p>
      </div>
    </div>
  )
}
