import { useState } from 'react'
import DataTable from './DataTable'
import ExcelUpload from './ExcelUpload'
import DocViewer from './DocViewer'
import Toast, { useToast } from './Toast'
import { saveToStorage, loadFromStorage, generateId } from '../utils/storage'
import { saveFile, getFileURL, deleteFile } from '../utils/fileDB'

const KEY = 'sit_kepegawaian'
const KATEGORI = ['Dokumen Pribadi', 'Dokumen Kepegawaian', 'Dokumen Absensi', 'SKP']
const COLUMNS = [
  { key: 'nama',       label: 'Nama Pegawai' },
  { key: 'nipnik',     label: 'NIP / NRK' },
  { key: 'kategori',   label: 'Kategori' },
  { key: 'keterangan', label: 'Keterangan' },
  { key: 'namaFile',   label: 'File' },
  { key: 'aksi',       label: 'Aksi' },
]
const EMPTY = { nama: '', nipnik: '', kategori: '', keterangan: '', namaFile: '' }

export default function Kepegawaian() {
  const [data, setData]           = useState(() => loadFromStorage(KEY))
  const [form, setForm]           = useState(EMPTY)
  const [pendingFile, setPending] = useState(null)
  const [modal, setModal]         = useState(null)
  const [editMode, setEditMode]   = useState(false)
  const [editForm, setEditForm]   = useState(null)
  const [editFile, setEditFile]   = useState(null)
  const [viewer, setViewer]       = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast, showToast, closeToast } = useToast()
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const fe = (k, v) => setEditForm(p => ({ ...p, [k]: v }))

  const handlePdfChange = (e) => {
    const file = e.target.files[0]; if (!file) return
    f('namaFile', file.name); setPending(file)
  }

  const handleEditFileChange = (e) => {
    const file = e.target.files[0]; if (!file) return
    setEditFile(file); fe('namaFile', file.name)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nama.trim())   return alert('Nama Pegawai wajib diisi.')
    if (!form.nipnik.trim()) return alert('NIP / NRK wajib diisi.')
    if (!form.kategori)      return alert('Kategori Dokumen wajib dipilih.')
    const id  = generateId()
    const row = { ...form, id }
    if (pendingFile) await saveFile(id, pendingFile)
    const next = [...data, row]; setData(next); saveToStorage(KEY, next)
    setForm(EMPTY); setPending(null); showToast('Data berhasil ditambahkan')
  }

  const handleSaveEdit = async () => {
    if (!editForm.nama.trim())   return alert('Nama Pegawai wajib diisi.')
    if (!editForm.nipnik.trim()) return alert('NIP / NRK wajib diisi.')
    setIsLoading(true)
    try {
      let updatedRow = { ...editForm }
      if (editFile) {
        await saveFile(editForm.id, editFile)
        updatedRow.namaFile = editFile.name
      }
      const next = data.map(d => d.id === updatedRow.id ? updatedRow : d)
      setData(next); saveToStorage(KEY, next)
      setModal({ row: updatedRow, fileUrl: editFile ? await getFileURL(updatedRow.id) : modal.fileUrl })
      setEditMode(false); setEditFile(null)
      showToast('Data berhasil diperbarui')
    } catch (err) {
      console.error(err); showToast('Gagal menyimpan perubahan', 'error')
    } finally { setIsLoading(false) }
  }

  const handleDelete = async (indices) => {
    for (const i of indices) {
      const row = data[i]
      if (row?.id && row?.namaFile) await deleteFile(row.id)
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
      namaFile:     r['File']          || r['Nama File']   || r['namaFile']   || '',
    }))
    const next = [...data, ...mapped]; setData(next); saveToStorage(KEY, next)
    showToast('Data berhasil ditambahkan')
  }

  const openDetail = async (row) => {
    let fileUrl = null
    if (row.id && row.namaFile) { try { fileUrl = await getFileURL(row.id) } catch { /* not found */ } }
    setModal({ row, fileUrl }); setEditMode(false); setEditFile(null)
  }

  const startEdit = () => { setEditForm({ ...modal.row }); setEditMode(true); setEditFile(null) }
  const cancelEdit = () => { setEditMode(false); setEditFile(null) }

  const renderCell = (col, row) => {
    if (col.key === 'aksi') return (
      <button onClick={() => openDetail(row)}
        className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline underline-offset-2">
        Lihat Detail
      </button>
    )
    if (col.key === 'namaFile') return <span className="text-slate-500 text-xs">{row.namaFile || '-'}</span>
    return row[col.key] || '-'
  }

  return (
    <div className="space-y-6 max-w-screen-xl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {KATEGORI.map(k => (
          <div key={k} className="card py-4">
            <p className="text-2xl font-bold text-indigo-600">{data.filter(d => d.kategori === k).length}</p>
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
              <label className="label">Upload File Dokumen (PDF)</label>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="cursor-pointer border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm px-4 py-2.5 rounded-xl transition">
                  Pilih File PDF
                  <input type="file" accept=".pdf" className="hidden" onChange={handlePdfChange} />
                </label>
                {form.namaFile && <span className="text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">{form.namaFile}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
            <button type="submit" className="btn-primary">Simpan</button>
            <ExcelUpload onData={handleExcel} />
            <button type="button" onClick={() => { setForm(EMPTY); setPending(null) }} className="btn-secondary">Reset</button>
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
              <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="label">Nama Pegawai</label>
                  <input className="input" value={editForm.nama} onChange={e => fe('nama', e.target.value)} /></div>
                <div><label className="label">NIP / NRK</label>
                  <input className="input" value={editForm.nipnik} onChange={e => fe('nipnik', e.target.value)} /></div>
                <div><label className="label">Kategori Dokumen</label>
                  <select className="input" value={editForm.kategori} onChange={e => fe('kategori', e.target.value)}>
                    {KATEGORI.map(k => <option key={k}>{k}</option>)}
                  </select></div>
                <div><label className="label">Keterangan</label>
                  <input className="input" value={editForm.keterangan} onChange={e => fe('keterangan', e.target.value)} /></div>
                <div className="sm:col-span-2">
                  <label className="label">Upload Dokumen Baru (PDF)</label>
                  <label className="cursor-pointer inline-flex items-center gap-2 border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm px-4 py-2.5 rounded-xl transition">
                    {editFile ? editFile.name : (editForm.namaFile ? `Ganti: ${editForm.namaFile}` : 'Pilih File PDF')}
                    <input type="file" accept=".pdf" className="hidden" onChange={handleEditFileChange} />
                  </label>
                  {editFile && <span className="ml-3 text-xs text-emerald-600 font-medium">File baru dipilih</span>}
                </div>
              </div>
            ) : (
              <>
                <div className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-3">
                  {[['Nama Pegawai', modal.row.nama], ['NIP / NRK', modal.row.nipnik],
                    ['Kategori', modal.row.kategori], ['Keterangan', modal.row.keterangan],
                    ['File', modal.row.namaFile || '-'],
                  ].map(([k, v]) => (
                    <div key={k} className="text-sm">
                      <p className="text-slate-400 text-xs mb-0.5">{k}</p>
                      <p className="text-slate-800 font-medium">{v || '-'}</p>
                    </div>
                  ))}
                </div>
                {modal.fileUrl ? (
                  <div className="px-6 pb-2">
                    <p className="text-xs text-slate-400 mb-2">Pratinjau Dokumen</p>
                    <DocViewer src={modal.fileUrl} fileName={modal.row.namaFile} />
                  </div>
                ) : (
                  <div className="px-6 pb-4">
                    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl py-6 text-center text-sm text-slate-400">
                      {modal.row.namaFile ? 'File tidak ditemukan di penyimpanan.' : 'Tidak ada file dokumen.'}
                      <div className="mt-3">
                        <label className="cursor-pointer inline-flex items-center gap-2 border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-medium px-4 py-2 rounded-xl transition">
                          Upload Dokumen PDF
                          <input type="file" accept=".pdf" className="hidden" onChange={async (e) => {
                            const file = e.target.files[0]; if (!file) return
                            await saveFile(modal.row.id, file)
                            const fileUrl = await getFileURL(modal.row.id)
                            const updatedRow = { ...modal.row, namaFile: file.name }
                            const next = data.map(d => d.id === modal.row.id ? updatedRow : d)
                            setData(next); saveToStorage(KEY, next)
                            setModal({ row: updatedRow, fileUrl })
                            showToast('Dokumen berhasil diupload')
                          }} />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="px-6 pb-6 mt-2 flex flex-wrap gap-2">
              {editMode ? (
                <>
                  <button onClick={handleSaveEdit} disabled={isLoading} className="btn-primary flex-1">
                    {isLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                  <button onClick={cancelEdit} className="btn-secondary flex-1">Batal</button>
                </>
              ) : (
                <>
                  <button onClick={startEdit} className="btn-primary flex-1">Edit Data</button>
                  {modal.fileUrl && (
                    <button onClick={() => { setViewer(modal.fileUrl); setModal(null) }} className="btn-secondary flex-1">Buka Layar Penuh</button>
                  )}
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