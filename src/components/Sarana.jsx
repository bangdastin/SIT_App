import { useState } from 'react'
import DataTable from './DataTable'
import ExcelUpload from './ExcelUpload'
import DocViewer from './DocViewer'
import Toast, { useToast } from './Toast'
import { saveToStorage, loadFromStorage, generateId } from '../utils/storage'
import { saveFile, getFileURL, deleteFile } from '../utils/fileDB'

const KEY = 'sit_sarana'
const JENIS_KIB = ['KIB A', 'KIB B', 'KIB C', 'KIB E']
const EMPTY = { jenisKIB: JENIS_KIB[0], tahun: '', namaFile: '' }
const COLUMNS = [
  { key: 'jenisKIB',     label: 'Jenis KIB' },
  { key: 'namaFile',     label: 'Nama Dokumen' },
  { key: 'tahun',        label: 'Tahun' },
  { key: 'tanggalInput', label: 'Tanggal Input' },
  { key: 'aksi',         label: 'Aksi' },
]

export default function Sarana() {
  const [data, setData]           = useState(() => loadFromStorage(KEY))
  const [form, setForm]           = useState(EMPTY)
  const [pendingFile, setPending] = useState(null)
  const [editTahun, setEditTahun] = useState(null)
  const [modal, setModal]         = useState(null)
  const [viewer, setViewer]       = useState(null)
  const { toast, showToast, closeToast } = useToast()
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handlePdfChange = (e) => {
    const file = e.target.files[0]; if (!file) return
    f('namaFile', file.name); setPending(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.jenisKIB)     return alert('Jenis KIB wajib dipilih.')
    if (!form.tahun.trim()) return alert('Tahun wajib diisi.')
    if (!form.namaFile)     return alert('File dokumen wajib diupload.')
    const id  = generateId()
    const row = { ...form, id, tanggalInput: new Date().toLocaleDateString('id-ID') }
    if (pendingFile) await saveFile(id, pendingFile)
    const next = [...data, row]; setData(next); saveToStorage(KEY, next)
    setForm(EMPTY); setPending(null)
    showToast('Data berhasil ditambahkan')
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
      id:           generateId(),
      jenisKIB:     r['Jenis KIB']    || r['jenisKIB']   || r['KIB']        || JENIS_KIB[0],
      namaFile:     r['Nama Dokumen'] || r['Nama File']  || r['namaFile']   || '',
      tahun:        String(r['Tahun'] || r['tahun']      || ''),
      tanggalInput: r['Tanggal Input']|| r['Tanggal']    || new Date().toLocaleDateString('id-ID'),
    }))
    const next = [...data, ...mapped]; setData(next); saveToStorage(KEY, next)
    showToast('Data berhasil ditambahkan')
  }

  const saveTahun = () => {
    if (!editTahun) return
    const next = data.map((row, i) => i === editTahun.origIdx ? { ...row, tahun: editTahun.value } : row)
    setData(next); saveToStorage(KEY, next); setEditTahun(null)
  }

  const openDetail = async (row) => {
    let fileUrl = null
    if (row.id && row.namaFile) fileUrl = await getFileURL(row.id)
    setModal({ row, fileUrl })
  }

  const renderCell = (col, row, origIdx) => {
    if (col.key === 'aksi') return (
      <button onClick={() => openDetail(row)}
        className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline underline-offset-2">
        Lihat Detail
      </button>
    )
    if (col.key === 'tahun') {
      if (editTahun?.origIdx === origIdx) return (
        <span className="flex items-center gap-1.5">
          <input autoFocus
            className="border border-slate-300 rounded-lg px-2 py-1 text-xs w-20 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={editTahun.value}
            onChange={e => setEditTahun(et => ({ ...et, value: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && saveTahun()}
          />
          <button onClick={saveTahun} className="text-xs text-emerald-600 font-semibold">Simpan</button>
          <button onClick={() => setEditTahun(null)} className="text-xs text-slate-400">Batal</button>
        </span>
      )
      return (
        <span className="flex items-center gap-2">
          <span>{row.tahun || '-'}</span>
          <button onClick={() => setEditTahun({ origIdx, value: row.tahun || '' })}
            className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline underline-offset-2">
            Edit
          </button>
        </span>
      )
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="label">Jenis KIB <span className="text-rose-400 normal-case">*</span></label>
              <select className="input" value={form.jenisKIB} onChange={e => f('jenisKIB', e.target.value)}>
                {JENIS_KIB.map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tahun <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.tahun} onChange={e => f('tahun', e.target.value)} placeholder="Contoh: 2024" />
            </div>
            <div>
              <label className="label">Upload Dokumen (PDF) <span className="text-rose-400 normal-case">*</span></label>
              <label className="cursor-pointer flex items-center border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm px-4 py-2.5 rounded-xl transition">
                <span className="truncate">{form.namaFile || 'Pilih File PDF'}</span>
                <input type="file" accept=".pdf" className="hidden" onChange={handlePdfChange} />
              </label>
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
          <p className="section-title mb-0">Arsip Sarana & Prasarana</p>
          <span className="text-xs text-slate-400">{data.length} total</span>
        </div>
        <DataTable columns={COLUMNS} data={data} onDelete={handleDelete} renderCell={renderCell} />
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl border border-slate-200 shadow-xl my-8">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Detail Dokumen Sarana</h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-3">
              {[['Jenis KIB',modal.row.jenisKIB],['Tahun',modal.row.tahun],
                ['Nama Dokumen',modal.row.namaFile||'-'],['Tanggal Input',modal.row.tanggalInput],
              ].map(([k,v]) => (
                <div key={k} className="text-sm">
                  <p className="text-slate-400 text-xs mb-0.5">{k}</p>
                  <p className="text-slate-800 font-medium">{v||'-'}</p>
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
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl py-8 text-center text-sm text-slate-400">
                  {modal.row.namaFile ? 'File tidak ditemukan di penyimpanan.' : 'Tidak ada file dokumen.'}
                </div>
              </div>
            )}
            <div className="px-6 pb-6 flex gap-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Tutup</button>
              {modal.fileUrl && (
                <button onClick={() => { setViewer(modal.fileUrl); setModal(null) }} className="btn-primary flex-1">Buka Layar Penuh</button>
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
