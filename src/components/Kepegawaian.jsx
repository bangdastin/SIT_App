import { useState } from 'react'
import DataTable from './DataTable'
import ExcelUpload from './ExcelUpload'
import DocViewer from './DocViewer'
import { saveToStorage, loadFromStorage, generateId } from '../utils/storage'
import { saveFile, getFileURL, deleteFile } from '../utils/fileDB'

const KEY = 'sit_kepegawaian'
const KATEGORI = ['Dokumen Pribadi', 'Dokumen Kepegawaian', 'Dokumen Absensi']
const COLUMNS = [
  { key: 'nama',         label: 'Nama Pegawai' },
  { key: 'nipnik',       label: 'NIP / NIK' },
  { key: 'kategori',     label: 'Kategori' },
  { key: 'keterangan',   label: 'Keterangan' },
  { key: 'namaFile',     label: 'File' },
  { key: 'tanggalInput', label: 'Tanggal Input' },
  { key: 'aksi',         label: 'Aksi' },
]
const EMPTY = { nama: '', nipnik: '', kategori: KATEGORI[0], keterangan: '', namaFile: '' }

export default function Kepegawaian() {
  const [data, setData]           = useState(() => loadFromStorage(KEY))
  const [form, setForm]           = useState(EMPTY)
  const [pendingFile, setPending] = useState(null)
  const [modal, setModal]         = useState(null)
  const [viewer, setViewer]       = useState(null)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handlePdfChange = (e) => {
    const file = e.target.files[0]; if (!file) return
    f('namaFile', file.name); setPending(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nama.trim()) return alert('Nama Pegawai wajib diisi.')
    const id  = generateId()
    const row = { ...form, id, tanggalInput: new Date().toLocaleDateString('id-ID') }
    if (pendingFile) await saveFile(id, pendingFile)
    const next = [...data, row]; setData(next); saveToStorage(KEY, next)
    setForm(EMPTY); setPending(null)
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
      nama:         r['Nama Pegawai']     || r['Nama']         || r['nama']       || '',
      nipnik:       String(r['NIP/NIK']   || r['NIP']          || r['NIK']        || r['nipnik'] || ''),
      kategori:     r['Kategori Dokumen'] || r['Kategori']     || r['kategori']   || KATEGORI[0],
      keterangan:   r['Keterangan']       || r['Catatan']      || r['keterangan'] || '',
      namaFile:     r['File']             || r['Nama File']    || r['namaFile']   || '',
      tanggalInput: r['Tanggal Input']    || r['Tanggal']      || new Date().toLocaleDateString('id-ID'),
    }))
    const next = [...data, ...mapped]; setData(next); saveToStorage(KEY, next)
  }

  const openDetail = async (row) => {
    let fileUrl = null
    if (row.id && row.namaFile) fileUrl = await getFileURL(row.id)
    setModal({ row, fileUrl })
  }

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <div>
              <label className="label">Nama Pegawai <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.nama} onChange={e => f('nama', e.target.value)} placeholder="Nama lengkap pegawai" />
            </div>
            <div>
              <label className="label">NIP / NIK</label>
              <input className="input" value={form.nipnik} onChange={e => f('nipnik', e.target.value)} placeholder="Nomor Induk / NIK" />
            </div>
            <div>
              <label className="label">Kategori Dokumen</label>
              <select className="input" value={form.kategori} onChange={e => f('kategori', e.target.value)}>
                {KATEGORI.map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Keterangan</label>
              <input className="input" value={form.keterangan} onChange={e => f('keterangan', e.target.value)} placeholder="Opsional" />
            </div>
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
              <h3 className="font-bold text-slate-800">Detail Dokumen Pegawai</h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-3">
              {[['Nama Pegawai',modal.row.nama],['NIP / NIK',modal.row.nipnik],
                ['Kategori',modal.row.kategori],['Keterangan',modal.row.keterangan],
                ['Tanggal Input',modal.row.tanggalInput],['File',modal.row.namaFile||'-'],
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
