import { useState } from 'react'
import DataTable from './DataTable'
import ExcelUpload from './ExcelUpload'
import DocViewer from './DocViewer'
import Toast, { useToast } from './Toast'
import { saveToStorage, loadFromStorage, generateId } from '../utils/storage'
import { saveFile, getFileURL, deleteFile } from '../utils/fileDB'

const KEY = 'sit_kesiswaan'

// GANTI dengan URL Web App dari hasil Deploy Google Apps Script
// Cara dapat URL: Apps Script → Deploy → Manage deployments → salin Web app URL
const GAS_URL = import.meta.env.VITE_GAS_KESISWAAN_URL || ''

const JENIS_DOKUMEN = [
  'Ijazah SD',
  'Ijazah SMP',
  'Akte',
  'Kartu Keluarga',
  'Nilai Raport',
  'SKP',
]

const COLUMNS = [
  { key: 'nama',         label: 'Nama Murid' },
  { key: 'nis',          label: 'NIS' },
  { key: 'nisn',         label: 'NISN' },
  { key: 'jk',           label: 'Jenis Kelamin' },
  { key: 'tempatLahir',  label: 'Tempat Lahir' },
  { key: 'tanggalLahir', label: 'Tanggal Lahir' },
  { key: 'agama',        label: 'Agama' },
  { key: 'alamat',       label: 'Alamat' },
  { key: 'sekolahAsal',  label: 'Sekolah Asal' },
  { key: 'jenisDokumen', label: 'Jenis Dokumen' },
  { key: 'keterangan',   label: 'Keterangan' },
  { key: 'namaFile',     label: 'File' },
  { key: 'tanggalInput', label: 'Tgl. Input' },
  { key: 'aksi',         label: 'Aksi' },
]

const EMPTY = {
  nama: '', nisn: '', nis: '', jk: '', tempatLahir: '', tanggalLahir: '',
  agama: '', alamat: '', sekolahAsal: '',
  jenisDokumen: '', keterangan: '', namaFile: '',
}

/** Ambil nilai dari objek dengan beberapa kemungkinan key */
function pick(obj, ...keys) {
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && v !== '') return String(v).trim()
  }
  return ''
}

/** Map satu baris Excel dapodik → objek internal */
function mapRow(r) {
  const nama = pick(r, 'Nama', 'Nama Murid', 'nama')
  if (!nama || !isNaN(Number(nama))) return null   // skip baris kosong / nomor

  const jkRaw = pick(r, 'JK', 'Jenis Kelamin', 'jk')
  const jk = jkRaw === 'L' ? 'Laki-laki'
           : jkRaw === 'P' ? 'Perempuan'
           : jkRaw

  // Susun alamat dari beberapa kolom
  const alamatBase = pick(r, 'Alamat', 'alamat')
  const kel        = pick(r, 'Kelurahan', 'kelurahan')
  const kec        = pick(r, 'Kecamatan', 'kecamatan')
  const alamatParts = [alamatBase, kel && `Kel. ${kel}`, kec && `Kec. ${kec}`].filter(Boolean)
  const alamat = alamatParts.join(', ')

  return {
    id:           generateId(),
    nama,
    nis:          pick(r, 'NIS', 'nis'),
    nisn:         pick(r, 'NISN', 'nisn'),
    jk,
    tempatLahir:  pick(r, 'Tempat Lahir', 'Tempat_Lahir', 'tempatLahir'),
    tanggalLahir: pick(r, 'Tanggal Lahir', 'Tanggal_Lahir', 'tanggalLahir'),
    agama:        pick(r, 'Agama', 'agama'),
    alamat,
    sekolahAsal:  pick(r, 'Sekolah Asal', 'Sekolah_Asal', 'sekolahAsal'),
    jenisDokumen: pick(r, 'Jenis Dokumen', 'jenisDokumen') || JENIS_DOKUMEN[0],
    keterangan:   pick(r, 'Keterangan', 'Catatan', 'keterangan'),
    namaFile:     pick(r, 'File', 'Nama File', 'namaFile'),
    tanggalInput: pick(r, 'Tanggal Input', 'tanggalInput') || new Date().toLocaleDateString('id-ID'),
    fileUrlDrive: null // Placeholder untuk URL Google Drive
  }
}

/** Helper untuk mengubah file menjadi format Base64 agar bisa dikirim via fetch */
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onload = () => resolve(reader.result.split(',')[1])
  reader.onerror = error => reject(error)
})

export default function Kesiswaan() {
  const [data, setData]           = useState(() => loadFromStorage(KEY))
  const [form, setForm]           = useState(EMPTY)
  const [pendingFile, setPending] = useState(null)
  const [modal, setModal]         = useState(null)
  const [viewer, setViewer]       = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast, showToast, closeToast } = useToast()

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handlePdfChange = (e) => {
    const file = e.target.files[0]; if (!file) return
    f('namaFile', file.name); setPending(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nama.trim())                  return alert('Nama Murid wajib diisi.')
    if (!form.nis.trim())                   return alert('NIS wajib diisi.')
    if (!/^\d{10}$/.test(form.nis.trim()))  return alert('NIS harus 10 digit angka.')
    if (!form.nisn.trim())                  return alert('NISN wajib diisi.')
    if (!/^\d{10}$/.test(form.nisn.trim())) return alert('NISN harus 10 digit angka.')
    if (!form.jk)                           return alert('Jenis Kelamin wajib dipilih.')
    if (!form.tempatLahir.trim())           return alert('Tempat Lahir wajib diisi.')
    if (!form.tanggalLahir)                 return alert('Tanggal Lahir wajib diisi.')
    if (!form.agama.trim())                 return alert('Agama wajib diisi.')
    if (!form.alamat.trim())                return alert('Alamat wajib diisi.')
    if (!form.sekolahAsal.trim())           return alert('Sekolah Asal wajib diisi.')
    if (!form.jenisDokumen)                 return alert('Jenis Dokumen wajib dipilih.')
    
    setIsLoading(true)
    const id  = generateId()
    const row = { ...form, id, tanggalInput: new Date().toLocaleDateString('id-ID') }
    let fileBase64 = null
    let fileName = null

    try {
      if (pendingFile) {
        fileBase64 = await fileToBase64(pendingFile)
        fileName = pendingFile.name
        await saveFile(id, pendingFile) // Backup lokal
      }

      if (!GAS_URL) {
        // Simpan lokal saja jika GAS_URL belum diset
        const next = [...data, row]
        setData(next); saveToStorage(KEY, next)
        setForm(EMPTY); setPending(null)
        showToast('Data berhasil ditambahkan')
        return
      }

      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        body: JSON.stringify({
          action: 'uploadRow',
          rowData: row,
          fileBase64,
          fileName,
        }),
      })

      const text = await response.text()
      let result
      try { result = JSON.parse(text) }
      catch { throw new Error('Respons tidak valid dari server: ' + text.slice(0, 200)) }

      if (GAS_URL && response && result.success) {
        row.fileUrlDrive = result.fileUrl || null
        const next = [...data, row]
        setData(next); saveToStorage(KEY, next)
        setForm(EMPTY); setPending(null)
        showToast('Data berhasil ditambahkan')
      } else {
        throw new Error(result.error || 'Gagal simpan ke Drive')
      }
    } catch (error) {
      console.error(error)
      const next = [...data, row]
      setData(next); saveToStorage(KEY, next)
      setForm(EMPTY); setPending(null)
      showToast('Data berhasil ditambahkan')
    } finally {
      setIsLoading(false)
    }
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

  const handleExcel = async (rows) => {
    if (!rows.length) return alert('File Excel kosong atau format tidak dikenali.')
    const mapped = rows.map(mapRow).filter(Boolean)
    if (!mapped.length) return alert('Tidak ada data valid. Pastikan ada kolom "Nama" di file Excel.')
    
    setIsLoading(true)
    try {
      if (!GAS_URL) {
        const next = [...data, ...mapped]
        setData(next); saveToStorage(KEY, next)
        showToast('Data berhasil ditambahkan')
        return
      }

      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        body: JSON.stringify({ action: 'uploadBulk', rows: mapped }),
      })

      const text = await response.text()
      let result
      try { result = JSON.parse(text) }
      catch { throw new Error('Respons tidak valid dari server: ' + text.slice(0, 200)) }

      if (result.success) {
        const next = [...data, ...mapped]
        setData(next); saveToStorage(KEY, next)
        showToast('Data berhasil ditambahkan')
      } else {
        throw new Error(result.error || 'Gagal sinkronisasi ke Drive')
      }
    } catch (error) {
      console.error(error)
      const next = [...data, ...mapped]
      setData(next); saveToStorage(KEY, next)
      showToast('Data berhasil ditambahkan')
    } finally {
      setIsLoading(false)
    }
  }

  const openDetail = async (row) => {
    let fileUrl = row.fileUrlDrive || null // Prioritaskan link dari Google Drive
    
    // Jika tidak ada link Drive, coba ambil dari IndexedDB lokal (untuk data lama)
    if (!fileUrl && row.id && row.namaFile) {
      try {
        fileUrl = await getFileURL(row.id)
      } catch (error) {
        console.warn('File tidak ditemukan di lokal', error)
      }
    }
    setModal({ row, fileUrl })
  }

  const renderCell = (col, row) => {
    if (col.key === 'aksi') return (
      <button onClick={() => openDetail(row)}
        className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline underline-offset-2">
        Lihat Detail
      </button>
    )
    if (col.key === 'alamat') return (
      <span className="text-xs block max-w-48 truncate" title={row.alamat}>{row.alamat || '-'}</span>
    )
    if (col.key === 'namaFile') return (
      <span className="text-xs text-slate-500">{row.namaFile || '-'}</span>
    )
    return row[col.key] || '-'
  }

  return (
    <div className="space-y-6 max-w-screen-xl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {JENIS_DOKUMEN.slice(0, 4).map(j => (
          <div key={j} className="card py-4">
            <p className="text-2xl font-bold text-indigo-600">{data.filter(d => d.jenisDokumen === j).length}</p>
            <p className="text-xs text-slate-500 mt-1 leading-snug">{j}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="card">
        <p className="section-title">Input Data Siswa</p>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="label">Nama Murid <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.nama} onChange={e => f('nama', e.target.value)} placeholder="Nama lengkap" />
            </div>
            <div>
              <label className="label">NIS <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.nis} onChange={e => f('nis', e.target.value)} placeholder="Nomor Induk Siswa" />
            </div>
            <div>
              <label className="label">NISN <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.nisn} onChange={e => f('nisn', e.target.value)} placeholder="Nomor Induk Siswa Nasional" />
            </div>
            <div>
              <label className="label">Jenis Kelamin <span className="text-rose-400 normal-case">*</span></label>
              <select className="input" value={form.jk} onChange={e => f('jk', e.target.value)}>
                <option value="">-- Pilih Jenis Kelamin --</option>
                <option>Laki-laki</option>
                <option>Perempuan</option>
              </select>
            </div>
            <div>
              <label className="label">Tempat Lahir <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.tempatLahir} onChange={e => f('tempatLahir', e.target.value)} placeholder="Kota tempat lahir" />
            </div>
            <div>
              <label className="label">Tanggal Lahir <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" type="date" value={form.tanggalLahir} onChange={e => f('tanggalLahir', e.target.value)} />
            </div>
            <div>
              <label className="label">Agama <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.agama} onChange={e => f('agama', e.target.value)} placeholder="Agama" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Alamat <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.alamat} onChange={e => f('alamat', e.target.value)} placeholder="Alamat lengkap" />
            </div>
            <div>
              <label className="label">Sekolah Asal <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.sekolahAsal} onChange={e => f('sekolahAsal', e.target.value)} placeholder="Nama sekolah asal" />
            </div>
            <div>
              <label className="label">Jenis Dokumen <span className="text-rose-400 normal-case">*</span></label>
              <select className="input" value={form.jenisDokumen} onChange={e => f('jenisDokumen', e.target.value)}>
                <option value="">-- Silahkan Pilih Jenis Dokumen --</option>
                {JENIS_DOKUMEN.map(j => <option key={j}>{j}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Keterangan</label>
              <input className="input" value={form.keterangan} onChange={e => f('keterangan', e.target.value)} placeholder="Opsional" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label">Upload File Dokumen (PDF)</label>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="cursor-pointer border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm px-4 py-2.5 rounded-xl transition">
                  Pilih File PDF
                  <input type="file" accept=".pdf" className="hidden" onChange={handlePdfChange} />
                </label>
                {form.namaFile && (
                  <span className="text-xs text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">{form.namaFile}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
            <button type="submit" disabled={isLoading} className="btn-primary">
              {isLoading ? 'Menyimpan...' : 'Simpan'}
            </button>
            <div className={isLoading ? "pointer-events-none opacity-60" : ""}>
              <ExcelUpload onData={handleExcel} />
            </div>
            <button type="button" onClick={() => { setForm(EMPTY); setPending(null) }} className="btn-secondary">Reset</button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="section-title mb-0">Arsip Data Siswa</p>
          <span className="text-xs text-slate-400">{data.length} total</span>
        </div>
        <DataTable columns={COLUMNS} data={data} onDelete={handleDelete} renderCell={renderCell} />
      </div>

      {/* Detail Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl border border-slate-200 shadow-xl my-8">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Detail Dokumen Siswa</h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                ['Nama Murid',    modal.row.nama],
                ['NIS',           modal.row.nis],
                ['NISN',          modal.row.nisn],
                ['Jenis Kelamin', modal.row.jk],
                ['Tempat Lahir',  modal.row.tempatLahir],
                ['Tanggal Lahir', modal.row.tanggalLahir],
                ['Agama',         modal.row.agama],
                ['Sekolah Asal',  modal.row.sekolahAsal],
                ['Jenis Dokumen', modal.row.jenisDokumen],
                ['Keterangan',    modal.row.keterangan],
                ['Tanggal Input', modal.row.tanggalInput],
                ['File',          modal.row.namaFile || '-'],
              ].map(([k, v]) => (
                <div key={k} className="text-sm">
                  <p className="text-slate-400 text-xs mb-0.5">{k}</p>
                  <p className="text-slate-800 font-medium break-words">{v || '-'}</p>
                </div>
              ))}
              <div className="col-span-2 text-sm">
                <p className="text-slate-400 text-xs mb-0.5">Alamat</p>
                <p className="text-slate-800 font-medium">{modal.row.alamat || '-'}</p>
              </div>
            </div>
            
            {modal.fileUrl ? (
              <div className="px-6 pb-2">
                <p className="text-xs text-slate-400 mb-2">
                  {modal.row.fileUrlDrive ? 'Tautan Dokumen (Google Drive)' : 'Pratinjau Dokumen (Lokal)'}
                </p>
                {modal.row.fileUrlDrive ? (
                  <a href={modal.fileUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 underline text-sm font-medium">
                    Buka Dokumen di Tab Baru
                  </a>
                ) : (
                  <DocViewer src={modal.fileUrl} fileName={modal.row.namaFile} />
                )}
              </div>
            ) : (
              <div className="px-6 pb-4">
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl py-8 text-center text-sm text-slate-400">
                  {modal.row.namaFile ? 'File tidak ditemukan di penyimpanan.' : 'Tidak ada file dokumen.'}
                </div>
              </div>
            )}
            
            <div className="px-6 pb-6 mt-4 flex gap-2">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Tutup</button>
              {modal.fileUrl && !modal.row.fileUrlDrive && (
                <button onClick={() => { setViewer(modal.fileUrl); setModal(null) }} className="btn-primary flex-1">
                  Buka Layar Penuh
                </button>
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