const menus = [
  { key: 'kesiswaan',   label: 'Kesiswaan' },
  { key: 'kepegawaian', label: 'Kepegawaian' },
  { key: 'sarana',      label: 'Sarana & Prasarana' },
  { key: 'persuratan',  label: 'Persuratan' },
]

export default function Sidebar({ active, onSelect, onLogout, user, mobileOpen, onMobileClose }) {
  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={onMobileClose} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full z-30 w-60 flex flex-col bg-slate-900
        transition-transform duration-300 ease-in-out
        lg:static lg:translate-x-0 lg:z-auto
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand */}
        <div className="px-6 py-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-black">SIT</span>
            </div>
            <div>
              <p className="text-white text-sm font-bold leading-tight">Sistem Informasi Terpadu</p>
              <p className="text-slate-400 text-xs">SMPN 82 Jakarta</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider px-3 mb-3">Menu</p>
          {menus.map(m => (
            <button
              key={m.key}
              onClick={() => { onSelect(m.key); onMobileClose?.() }}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition
                ${active === m.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              {m.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="px-3 py-2 mb-2">
            <p className="text-white text-sm font-medium">{user || 'Admin'}</p>
            <p className="text-slate-500 text-xs">Administrator</p>
          </div>
          <button
            onClick={onLogout}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-rose-600/80 transition"
          >
            Keluar
          </button>
        </div>
      </aside>
    </>
  )
}
