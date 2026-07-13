import { useState } from 'react'
import DataTable from './DataTable'
import ExcelUpload from './ExcelUpload'
import DocViewer from './DocViewer'
import Toast, { useToast } from './Toast'
import { saveToStorage, loadFromStorage, generateId } from '../utils/storage'
import { saveFile, getFileURL, deleteFile } from '../utils/fileDB'

const KEY = 'sit_kepegawaian'
const GAS_URL = import.meta.env.VITE_GAS_KEPEGAWAIAN_URL || ''
const KATEGORI = ['Dokumen Pribadi', 'Dokumen Kepegawaian', 'Dokumen Absensi', 'SKP']
const COLUMNS = [
  { key: 'nama',       label: 'Nama Pegawai' },
  { key: 'nipnik',     label: 'NIP / NRK' },
  { key: 'kategori',   label: 'Kategori' },
  { key: 'keterangan', label: 'Keterangan' },
  { key: 'dokumen',    label: 'Dokumen' },
  { key: 'aksi',       label: 'Aksi' },
]
const EMPTY = { nama: '', nipnik: '', kategori: '', keterangan: '' }

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onload = () => resolve(reader.result.split(',')[1])
  reader.onerror = reject
})

export default function Kepegawaian() {
  const [data, setData]           = useState(() => loadFromStorage(KEY))
  const [form, setForm]           = useState(EMPTY)
  const [pendingDocs, setPendingDocs] = useState([]) // [{ kategori, file }]
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
    if (!form.nama.trim())   return alert('Nama Pegawai wajib diisi.')
    if (!form.nipnik.trim()) return alert('NIP / NRK wajib diisi.')
    if (!form.kategori)      return alert('Kategori Dokumen wajib dipilih.')
    setIsLoading(true)
    const id = generateId()
    const docsMap = {}
    for (const d of pendingDocs) {
      if (!d.file) continue
      const fileId = `${id}_${d.kategori.replace(/\s+/g,'_')}`
      await saveFile(fileId, d.file)
      docsMap[d.kategori] = { namaFile: d.file.name, fileId, base64: GAS_URL ? await fileToBase64(d.file) : null }
    }
    const row = { ...form, id, dokumen: docsMap, tanggalInput: new Date().toLocaleDateString('id-ID') }
    try {
      if (GAS_URL) {
        await fetch(GAS_URL, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'uploadRow', rowData: row, dokumen: docsMap }),
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
    if (!editForm.nama.trim())   return alert('Nama Pegawai wajib diisi.')
    if (!editForm.nipnik.trim()) return alert('NIP / NRK wajib diisi.')
    setIsLoading(true)
    try {
      let updatedRow = { ...editForm }
      const existingDocs = { ...(editForm.dokumen || {}) }
      for (const d of editPendingDocs) {
        if (!d.file) continue
        const fileId = `${editForm.id}_${d.kategori.replace(/\s+/g,'_')}`
        await saveFile(fileId, d.file)
        existingDocs[d.kategori] = { namaFile: d.file.name, fileId }
      }
      updatedRow.dokumen = existingDocs
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
        for (const d of Object.values(row.dokumen)) {
          if (d.fileId) await deleteFile(d.fileId)
        }
      }
      if (GAS_URL && row?.id) {
        fetch(GAS_URL, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'deleteRow', id: row.id }),
        }).catch(err => console.warn('Gagal hapus GAS:', err))
      }
    }
    const idxSet = new Set(indices)
    const next = data.filter((_, x) => !idxSet.has(x))
    setData(next); saveToStorage(KEY, next)
  }

  const handleExcel = (rows) => {
    const mapped = rows.map(r => ({
      id: generateId(),
      nama:         r['Nama Pegawai'] || r['Nama']         || r['nama']       || '',
      nipnik:       String(r['NIP/NRK'] || r['NIP']        || r['NRK']        || r['nipnik'] || ''),
      kategori:     r['Kategori Dokumen'] || r['Kategori'] || r['kategori']   || KATEGORI[0],
      keterangan:   r['Keterangan']    || r['Catatan']     || r['keterangan'] || '',
      dokumen: {},
    }))
    const next = [...data, ...mapped]; setData(next); saveToStorage(KEY, next)
    showToast('Data berhasil ditambahkan')
  }

  const openDetail = (row) => { setModal({ row }); setEditMode(false); setEditPendingDocs([]) }
  const startEdit = () => { setEditForm({ ...modal.row }); setEditMode(true); setEditPendingDocs([]) }
  const cancelEdit = () => { setEditMode(false); setEditPendingDocs([]) }

  const renderCell = (col, row) => {
    if (col.key === 'aksi') return (
      <button onClick={() => openDetail(row)} className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline underline-offset-2">Lihat Detail</button>
    )
    if (col.key === 'dokumen') {
      const docs = row.dokumen || {}
      const keys = Object.keys(docs)
      return keys.length ? <span className="text-xs">{keys.join(', ')}</span> : <span className="text-xs text-slate-400">-</span>
    }
    return row[col.key] || '-'
  }

  return (
    <div className="space-y-6 max-w-screen-xl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {KATEGORI.map(k => (
          <div key={k} className="card py-4">
            <p className="text-2xl font-bold text-indigo-600">{data.filter(d => d.kategori === k || (d.dokumen && d.dokumen[k])).length}</p>
            <p className="text-xs text-slate-500 mt-1">{k}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <p className="section-title">Input Data Pegawai</p>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div><label className="label">Nama Pegawai <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.nama} onChange={e => f('nama', e.target.value)} placeholder="Nama lengkap pegawai" /></div>
            <div><label className="label">NIP / NRK <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.nipnik} onChange={e => f('nipnik', e.target.value)} placeholder="Nomor Induk Pegawai / NRK" /></div>
            <div><label className="label">Kategori Dokumen <span className="text-rose-400 normal-case">*</span></label>
              <select className="input" value={form.kategori} onChange={e => f('kategori', e.target.value)}>
                <option value="">-- Silahkan Pilih Kategori --</option>
                {KATEGORI.map(k => <option key={k}>{k}</option>)}
              </select></div>
            <div><label className="label">Keterangan</label>
              <input className="input" value={form.keterangan} onChange={e => f('keterangan', e.target.value)} placeholder="Opsional" /></div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Upload Dokumen (PDF)</label>
                <button type="button" onClick={() => setPendingDocs(p => [...p, { kategori: KATEGORI[0], file: null }])}
                  className="text-xs text-indigo-600 border border-indigo-300 px-3 py-1 rounded-lg font-semibold">+ Tambah Dokumen</button>
              </div>
              {pendingDocs.length === 0 && <p className="text-xs text-slate-400 italic">Klik "+ Tambah Dokumen" untuk upload file PDF</p>}
              <div className="space-y-2">
                {pendingDocs.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 flex-wrap bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <select className="input w-44 py-1.5 text-sm flex-shrink-0" value={d.kategori}
                      onChange={e => setPendingDocs(p => p.map((x, idx) => idx === i ? { ...x, kategori: e.target.value } : x))}>
                      {KATEGORI.map(k => <option key={k}>{k}</option>)}
                    </select>
                    <label className="cursor-pointer flex-1 min-w-0 border border-dashed border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-sm px-4 py-2 rounded-xl transition truncate">
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
          <p className="section-title mb-0">Arsip Data Pegawai</p>
          <span className="text-xs text-slate-400">{data.length} total</span>
        </div>
        <DataTable columns={COLUMNS} data={data} onDelete={handleDelete} renderCell={renderCell} />
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl border border-slate-200 shadow-xl my-8">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editMode ? 'Edit Data Pegawai' : 'Detail Dokumen Pegawai'}</h3>
              <button onClick={() => { setModal(null); setEditMode(false) }} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>

            {editMode && editForm ? (
              <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="label">Nama Pegawai</label><input className="input" value={editForm.nama} onChange={e => fe('nama', e.target.value)} /></div>
                  <div><label className="label">NIP / NRK</label><input className="input" value={editForm.nipnik} onChange={e => fe('nipnik', e.target.value)} /></div>
                  <div><label className="label">Kategori Dokumen</label>
                    <select className="input" value={editForm.kategori} onChange={e => fe('kategori', e.target.value)}>
                      {KATEGORI.map(k => <option key={k}>{k}</option>)}
                    </select></div>
                  <div><label className="label">Keterangan</label><input className="input" value={editForm.keterangan} onChange={e => fe('keterangan', e.target.value)} /></div>
                </div>
                {/* Dokumen tersimpan */}
                {Object.keys(editForm.dokumen || {}).length > 0 && (
                  <div>
                    <p className="label mb-2">Dokumen Tersimpan</p>
                    {Object.entries(editForm.dokumen).map(([kat, doc]) => (
                      <div key={kat} className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 mb-2 text-sm">
                        <span className="font-medium text-indigo-700 w-40 flex-shrink-0">{kat}</span>
                        <span className="text-slate-500 flex-1 truncate">{doc.namaFile}</span>
                        <button type="button" onClick={() => { const d = { ...editForm.dokumen }; delete d[kat]; fe('dokumen', d) }} className="text-rose-400 hover:text-rose-600 text-lg">&times;</button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Upload dokumen baru */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="label mb-0">Tambah / Ganti Dokumen</p>
                    <button type="button" onClick={() => setEditPendingDocs(p => [...p, { kategori: KATEGORI[0], file: null }])} className="text-xs text-indigo-600 border border-indigo-300 px-3 py-1 rounded-lg font-semibold">+ Dokumen Baru</button>
                  </div>
                  <div className="space-y-2">
                    {editPendingDocs.map((d, i) => (
                      <div key={i} className="flex items-center gap-3 flex-wrap bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                        <select className="input w-44 py-1.5 text-sm flex-shrink-0" value={d.kategori}
                          onChange={e => setEditPendingDocs(p => p.map((x, idx) => idx === i ? { ...x, kategori: e.target.value } : x))}>
                          {KATEGORI.map(k => <option key={k}>{k}</option>)}
                        </select>
                        <label className="cursor-pointer flex-1 min-w-0 border border-dashed border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-sm px-4 py-2 rounded-xl transition truncate">
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
                  {[['Nama Pegawai', modal.row.nama], ['NIP / NRK', modal.row.nipnik],
                    ['Kategori', modal.row.kategori], ['Keterangan', modal.row.keterangan],
                  ].map(([k, v]) => (
                    <div key={k} className="text-sm"><p className="text-slate-400 text-xs mb-0.5">{k}</p><p className="text-slate-800 font-medium">{v || '-'}</p></div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mb-2 font-medium">Dokumen</p>
                {Object.keys(modal.row.dokumen || {}).length === 0 ? (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl py-5 text-center text-sm text-slate-400">Belum ada dokumen.</div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(modal.row.dokumen).map(([kat, doc]) => (
                      <DocItem key={kat} label={kat} doc={doc} onView={url => setViewer(url)} />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="px-6 pb-6 mt-2 flex flex-wrap gap-2">
              {editMode ? (
                <>
                  <button onClick={handleSaveEdit} disabled={isLoading} className="btn-primary flex-1">{isLoading ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
                  <button onClick={cancelEdit} className="btn-secondary flex-1">Batal</button>
                </>
              ) : (
                <>
                  <button onClick={startEdit} className="btn-primary flex-1">Edit Data</button>
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

function DocItem({ label, doc, onView }) {
  const [url, setUrl] = useState(null)
  useState(() => {
    if (doc.fileId) getFileURL(doc.fileId).then(setUrl).catch(() => {})
    else if (doc.urlDrive) setUrl(doc.urlDrive)
  }, [])
  return (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm">
      <span className="font-medium text-slate-700 w-40 flex-shrink-0">{label}</span>
      <span className="text-slate-500 flex-1 truncate">{doc.namaFile || '-'}</span>
      {url && <button onClick={() => onView(url)} className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline flex-shrink-0">Lihat</button>}
      {doc.urlDrive && <a href={doc.urlDrive} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline flex-shrink-0">Drive</a>}
    </div>
  )
}
