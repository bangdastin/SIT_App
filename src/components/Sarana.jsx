import { useState } from 'react'
import DataTable from './DataTable'
import ExcelUpload from './ExcelUpload'
import Toast, { useToast } from './Toast'
import { saveToStorage, loadFromStorage, generateId } from '../utils/storage'
import { saveFile, getFileURL, deleteFile } from '../utils/fileDB'

const KEY = 'sit_sarana'
const GAS_URL = import.meta.env.VITE_GAS_SARANA_URL || ''
const JENIS_KIB = ['KIB A', 'KIB B', 'KIB C', 'KIB E']
const EMPTY = { jenisKIB: JENIS_KIB[0], tahun: '' }
const COLUMNS = [
  { key: 'jenisKIB', label: 'Jenis KIB' },
  { key: 'tahun',    label: 'Tahun' },
  { key: 'dokumen',  label: 'Dokumen' },
  { key: 'aksi',     label: 'Aksi' },
]

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onload = () => resolve(reader.result.split(',')[1])
  reader.onerror = reject
})

export default function Sarana() {
  const [data, setData]           = useState(() => {
    return loadFromStorage(KEY).map(d => {
      if (!d.dokumen) {
        return { ...d, dokumen: d.namaFile ? [{ namaFile: d.namaFile, fileId: d.id }] : [] }
      }
      return d
    })
  })
  const [form, setForm]           = useState(EMPTY)
  const [pendingDocs, setPendingDocs] = useState([])
  const [modal, setModal]         = useState(null)
  const [editMode, setEditMode]   = useState(false)
  const [editForm, setEditForm]   = useState(null)
  const [editPendingDocs, setEditPendingDocs] = useState([])
  const [viewer, setViewer]       = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast, showToast, closeToast } = useToast()
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const fe = (k, v) => setEditForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.jenisKIB)     return alert('Jenis KIB wajib dipilih.')
    if (!form.tahun.trim()) return alert('Tahun wajib diisi.')
    if (!pendingDocs.some(d => d.file)) return alert('Minimal 1 file dokumen wajib diupload.')
    setIsLoading(true)
    const id = generateId()
    const dokumen = []
    for (const d of pendingDocs) {
      if (!d.file) continue
      const fileId = `${id}_${dokumen.length}`
      await saveFile(fileId, d.file)
      dokumen.push({ namaFile: d.file.name, fileId })
    }
    const row = { ...form, id, dokumen, tanggalInput: new Date().toLocaleDateString('id-ID') }
    try {
      if (GAS_URL) {
        const filesBase64 = []
        for (const d of pendingDocs) {
          if (d.file) filesBase64.push({ fileName: d.file.name, base64: await fileToBase64(d.file) })
        }
        await fetch(GAS_URL, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'uploadRow', rowData: row, files: filesBase64 }),
        })
      }
      const next = [...data, row]; setData(next); saveToStorage(KEY, next)
      setForm(EMPTY); setPendingDocs([]); showToast('Data berhasil ditambahkan')
    } catch {
      const next = [...data, row]; setData(next); saveToStorage(KEY, next)
      setForm(EMPTY); setPendingDocs([]); showToast('Data berhasil ditambahkan')
    } finally { setIsLoading(false) }
  }

  const handleSaveEdit = async () => {
    if (!editForm.tahun?.trim()) return alert('Tahun wajib diisi.')
    setIsLoading(true)
    try {
      const existing = [...(editForm.dokumen || [])]
      for (const d of editPendingDocs) {
        if (!d.file) continue
        const fileId = `${editForm.id}_${existing.length}`
        await saveFile(fileId, d.file)
        existing.push({ namaFile: d.file.name, fileId })
      }
      const updatedRow = { ...editForm, dokumen: existing }
      const next = data.map(d => d.id === updatedRow.id ? updatedRow : d)
      setData(next); saveToStorage(KEY, next)
      setModal({ row: updatedRow }); setEditMode(false); setEditPendingDocs([])
      showToast('Data berhasil diperbarui')
    } catch (err) {
      console.error(err); showToast('Gagal menyimpan', 'error')
    } finally { setIsLoading(false) }
  }

  const handleDelete = async (indices) => {
    for (const i of indices) {
      const row = data[i]
      if (row?.dokumen) {
        for (const d of row.dokumen) { if (d.fileId) await deleteFile(d.fileId) }
      }
      if (GAS_URL && row?.id) {
        fetch(GAS_URL, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'deleteRow', id: row.id }),
        }).catch(() => {})
      }
    }
    const idxSet = new Set(indices)
    const next = data.filter((_, x) => !idxSet.has(x))
    setData(next); saveToStorage(KEY, next)
  }

  const handleExcel = (rows) => {
    const mapped = rows.map(r => ({
      id: generateId(),
      jenisKIB:     r['Jenis KIB'] || r['jenisKIB'] || r['KIB'] || JENIS_KIB[0],
      tahun:        String(r['Tahun'] || r['tahun'] || ''),
      dokumen:      r['Nama Dokumen'] || r['namaFile'] ? [{ namaFile: r['Nama Dokumen'] || r['namaFile'] || '', fileId: null }] : [],
      tanggalInput: r['Tanggal Input'] || new Date().toLocaleDateString('id-ID'),
    }))
    const next = [...data, ...mapped]; setData(next); saveToStorage(KEY, next)
    showToast('Data berhasil ditambahkan')
  }

  const renderCell = (col, row) => {
    if (col.key === 'aksi') return (
      <button onClick={() => { setModal({ row }); setEditMode(false); setEditPendingDocs([]) }}
        className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline underline-offset-2">Lihat Detail</button>
    )
    if (col.key === 'dokumen') {
      const docs = row.dokumen || []
      return docs.length ? <span className="text-xs">{docs.map(d => d.namaFile).join(', ')}</span> : <span className="text-xs text-slate-400">-</span>
    }
    return row[col.key] || '-'
  }

  return (
    <div className="space-y-6 max-w-screen-xl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {JENIS_KIB.map(k => (
          <div key={k} className="card py-4">
            <p className="text-2xl font-bold text-indigo-600">{data.filter(d => d.jenisKIB === k).length}</p>
            <p className="text-xs text-slate-500 mt-1">{k}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <p className="section-title">Input Data Sarana & Prasarana</p>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div><label className="label">Jenis KIB <span className="text-rose-400 normal-case">*</span></label>
              <select className="input" value={form.jenisKIB} onChange={e => f('jenisKIB', e.target.value)}>
                {JENIS_KIB.map(k => <option key={k}>{k}</option>)}
              </select></div>
            <div><label className="label">Tahun <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.tahun} onChange={e => f('tahun', e.target.value)} placeholder="Contoh: 2024" /></div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Upload Dokumen (PDF) <span className="text-rose-400 normal-case">*</span></label>
                <button type="button" onClick={() => setPendingDocs(p => [...p, { file: null }])}
                  className="text-xs text-indigo-600 border border-indigo-300 px-3 py-1 rounded-lg font-semibold">+ Tambah File</button>
              </div>
              {pendingDocs.length === 0 && <p className="text-xs text-slate-400 italic">Klik "+ Tambah File" untuk upload dokumen</p>}
              <div className="space-y-2">
                {pendingDocs.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <label className="cursor-pointer flex-1 border border-dashed border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-sm px-4 py-2 rounded-xl transition truncate">
                      {d.file ? d.file.name : 'Pilih File PDF'}
                      <input type="file" accept=".pdf" className="hidden"
                        onChange={e => { const file = e.target.files[0]; if (file) setPendingDocs(p => p.map((x, idx) => idx === i ? { ...x, file } : x)) }} />
                    </label>
                    <button type="button" onClick={() => setPendingDocs(p => p.filter((_, idx) => idx !== i))} className="text-rose-400 hover:text-rose-600 text-xl leading-none font-bold">&times;</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
            <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? 'Menyimpan...' : 'Simpan'}</button>
            <ExcelUpload onData={handleExcel} />
            <button type="button" onClick={() => { setForm(EMPTY); setPendingDocs([]) }} className="btn-secondary">Reset</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="section-title mb-0">Arsip Sarana & Prasarana</p>
          <span className="text-xs text-slate-400">{data.length} total</span>
        </div>
        <DataTable columns={COLUMNS} data={data} onDelete={handleDelete} renderCell={renderCell} />
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl border border-slate-200 shadow-xl my-8">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editMode ? 'Edit Data Sarana' : 'Detail Dokumen Sarana'}</h3>
              <button onClick={() => { setModal(null); setEditMode(false) }} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>

            {editMode && editForm ? (
              <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="label">Jenis KIB</label>
                    <select className="input" value={editForm.jenisKIB} onChange={e => fe('jenisKIB', e.target.value)}>
                      {JENIS_KIB.map(k => <option key={k}>{k}</option>)}
                    </select></div>
                  <div><label className="label">Tahun</label>
                    <input className="input" value={editForm.tahun} onChange={e => fe('tahun', e.target.value)} /></div>
                </div>
                {(editForm.dokumen || []).length > 0 && (
                  <div>
                    <p className="label mb-2">File Tersimpan</p>
                    {editForm.dokumen.map((d, i) => (
                      <div key={i} className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 mb-2 text-sm">
                        <span className="text-slate-600 flex-1 truncate">{d.namaFile}</span>
                        <button type="button" onClick={() => fe('dokumen', editForm.dokumen.filter((_, idx) => idx !== i))} className="text-rose-400 hover:text-rose-600 text-lg">&times;</button>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="label mb-0">Upload File Baru</p>
                    <button type="button" onClick={() => setEditPendingDocs(p => [...p, { file: null }])} className="text-xs text-indigo-600 border border-indigo-300 px-3 py-1 rounded-lg font-semibold">+ Tambah File</button>
                  </div>
                  <div className="space-y-2">
                    {editPendingDocs.map((d, i) => (
                      <div key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                        <label className="cursor-pointer flex-1 border border-dashed border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-sm px-4 py-2 rounded-xl transition truncate">
                          {d.file ? d.file.name : 'Pilih File PDF'}
                          <input type="file" accept=".pdf" className="hidden"
                            onChange={e => { const file = e.target.files[0]; if (file) setEditPendingDocs(p => p.map((x, idx) => idx === i ? { ...x, file } : x)) }} />
                        </label>
                        <button type="button" onClick={() => setEditPendingDocs(p => p.filter((_, idx) => idx !== i))} className="text-rose-400 hover:text-rose-600 text-xl leading-none font-bold">&times;</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-6 py-5">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-4">
                  {[['Jenis KIB', modal.row.jenisKIB], ['Tahun', modal.row.tahun]].map(([k, v]) => (
                    <div key={k} className="text-sm"><p className="text-slate-400 text-xs mb-0.5">{k}</p><p className="text-slate-800 font-medium">{v || '-'}</p></div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mb-2 font-medium">Dokumen</p>
                {(modal.row.dokumen || []).length === 0 ? (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl py-5 text-center text-sm text-slate-400">Belum ada dokumen.</div>
                ) : (
                  <div className="space-y-2">
                    {modal.row.dokumen.map((d, i) => (
                      <SaranaDocItem key={i} doc={d} onView={url => setViewer(url)} />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="px-6 pb-6 mt-2 flex gap-2">
              {editMode ? (
                <>
                  <button onClick={handleSaveEdit} disabled={isLoading} className="btn-primary flex-1">{isLoading ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
                  <button onClick={() => { setEditMode(false); setEditPendingDocs([]) }} className="btn-secondary flex-1">Batal</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditForm({ ...modal.row }); setEditMode(true); setEditPendingDocs([]) }} className="btn-primary flex-1">Edit Data</button>
                  <button onClick={() => setModal(null)} className="btn-secondary flex-1">Tutup</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {viewer && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900">
            <p className="text-white text-sm font-medium">Dokumen</p>
            <button onClick={() => setViewer(null)} className="text-white hover:text-slate-300 text-2xl leading-none">&times;</button>
          </div>
          <iframe src={viewer} className="flex-1 w-full" title="Dokumen" />
        </div>
      )}
    </div>
  )
}

function SaranaDocItem({ doc, onView }) {
  const [url, setUrl] = useState(null)
  useState(() => {
    if (doc.fileId) getFileURL(doc.fileId).then(setUrl).catch(() => {})
    else if (doc.urlDrive) setUrl(doc.urlDrive)
  }, [])
  return (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
      <span className="text-slate-600 flex-1 truncate">{doc.namaFile || '-'}</span>
      {url && <button onClick={() => onView(url)} className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline flex-shrink-0">Lihat</button>}
    </div>
  )
}
