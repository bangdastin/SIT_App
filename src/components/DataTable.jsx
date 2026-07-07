import { useState } from 'react'

const PAGE_SIZE = 20

/**
 * onDelete(indices: number[]) — dipanggil sekali dengan array origIdx yang harus dihapus
 */
export default function DataTable({ columns, data, onDelete, renderCell }) {
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState([])  // __origIdx values
  const [page, setPage]             = useState(1)
  const [selectAllPages, setSelectAllPages] = useState(false)

  const filtered = data
    .map((row, i) => ({ ...row, __origIdx: i }))
    .filter(row =>
      columns.some(col =>
        String(row[col.key] ?? '').toLowerCase().includes(search.toLowerCase())
      )
    )

  const filteredOrigIds = filtered.map(r => r.__origIdx)
  const totalPages      = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage        = Math.min(page, totalPages)
  const paged           = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const pagedOrigIds    = paged.map(r => r.__origIdx)

  // Checkbox header: checked jika semua di halaman ini tercentang (atau select all pages aktif)
  const pageAllChecked = pagedOrigIds.length > 0 && pagedOrigIds.every(id => selected.includes(id))

  const toggleAll = (e) => {
    if (e.target.checked) {
      // centang semua di halaman ini
      setSelected(prev => [...new Set([...prev, ...pagedOrigIds])])
    } else {
      // uncentang semua (termasuk batalkan select all pages)
      setSelectAllPages(false)
      setSelected([])
    }
  }

  const toggleOne = (origIdx) => {
    setSelectAllPages(false)
    setSelected(prev =>
      prev.includes(origIdx) ? prev.filter(id => id !== origIdx) : [...prev, origIdx]
    )
  }

  // Aktifkan select semua data di semua halaman
  const handleSelectAllPages = () => {
    setSelectAllPages(true)
    setSelected(filteredOrigIds)
  }

  const handleClearSelection = () => {
    setSelectAllPages(false)
    setSelected([])
  }

  const handleDelete = () => {
    if (selected.length === 0) return
    onDelete([...selected])
    setSelected([])
    setSelectAllPages(false)
    setPage(1)
  }

  const handleSearch = (v) => { setSearch(v); setSelected([]); setSelectAllPages(false); setPage(1) }
  const handleReset  = () => { setSearch(''); setSelected([]); setSelectAllPages(false); setPage(1) }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="Cari data..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="input flex-1 min-w-40"
        />
        <button onClick={handleReset} className="btn-secondary">Reset</button>
        <button
          onClick={handleDelete}
          disabled={selected.length === 0}
          className="btn-danger"
        >
          Hapus Arsip {selected.length > 0 && `(${selected.length})`}
        </button>
      </div>

      {/* Banner select all pages */}
      {pageAllChecked && !selectAllPages && totalPages > 1 && (
        <div className="mb-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-700 flex items-center justify-between">
          <span>{pagedOrigIds.length} data di halaman ini dipilih.</span>
          <button onClick={handleSelectAllPages} className="font-semibold underline underline-offset-2 hover:text-indigo-900">
            Pilih semua {filtered.length} data
          </button>
        </div>
      )}
      {selectAllPages && (
        <div className="mb-3 px-4 py-2.5 bg-indigo-100 border border-indigo-300 rounded-xl text-sm text-indigo-800 flex items-center justify-between">
          <span>Semua <strong>{filtered.length}</strong> data dipilih.</span>
          <button onClick={handleClearSelection} className="font-semibold underline underline-offset-2 hover:text-indigo-900">
            Batalkan pilihan
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-4 py-3 w-10">
                <input type="checkbox" checked={pageAllChecked} onChange={toggleAll} />
              </th>
              {columns.map(col => (
                <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="text-center py-12 text-slate-400 text-sm">
                  Tidak ada data ditemukan
                </td>
              </tr>
            ) : paged.map((row, i) => (
              <tr
                key={row.__origIdx}
                className={`transition hover:bg-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
              >
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectAllPages || selected.includes(row.__origIdx)}
                    onChange={() => toggleOne(row.__origIdx)}
                  />
                </td>
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {renderCell ? renderCell(col, row, row.__origIdx) : (row[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
        <p className="text-xs text-slate-400">
          {filtered.length} data &bull; halaman {safePage} dari {totalPages}
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(1)} disabled={safePage === 1}
            className="px-2 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition">«</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
            className="px-2 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition">‹</button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...')
              acc.push(p)
              return acc
            }, [])
            .map((p, i) =>
              p === '...'
                ? <span key={`e${i}`} className="px-2 py-1 text-xs text-slate-400">…</span>
                : <button key={p} onClick={() => setPage(p)}
                    className={`px-2.5 py-1 text-xs rounded border transition
                      ${safePage === p ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 hover:bg-slate-100'}`}>
                    {p}
                  </button>
            )
          }

          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
            className="px-2 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition">›</button>
          <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages}
            className="px-2 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition">»</button>
        </div>
      </div>
    </div>
  )
}
