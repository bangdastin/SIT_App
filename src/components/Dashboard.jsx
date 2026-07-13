import { useState } from 'react'
import Sidebar from './Sidebar'
import Kesiswaan from './Kesiswaan'
import Kepegawaian from './Kepegawaian'
import Sarana from './Sarana'
import Persuratan from './Persuratan'

const pageTitles = {
  kesiswaan:   'Kesiswaan',
  kepegawaian: 'Kepegawaian',
  sarana:      'Sarana & Prasarana',
  persuratan:  'Persuratan',
}

const pageMap = {
  kesiswaan:   <Kesiswaan />,
  kepegawaian: <Kepegawaian />,
  sarana:      <Sarana />,
  persuratan:  <Persuratan />,
}

export default function Dashboard({ user, onLogout }) {
  const [activePage, setActivePage] = useState('kesiswaan')
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar
        active={activePage}
        onSelect={setActivePage}
        onLogout={onLogout}
        user={user}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center gap-4 px-4 md:px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
          <button
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition"
            onClick={() => setMobileOpen(true)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h2 className="font-bold text-slate-800">{pageTitles[activePage]}</h2>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-lg">
              {user}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {pageMap[activePage]}
        </main>
      </div>
    </div>
  )
}
