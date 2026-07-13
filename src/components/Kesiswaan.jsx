import { useState, useEffect } from 'react'
import DataTable from './DataTable'
import ExcelUpload from './ExcelUpload'
import DocViewer from './DocViewer'
import Toast, { useToast } from './Toast'
import { saveToStorage, loadFromStorage, generateId } from '../utils/storage'
import { saveFile, getFileURL, deleteFile } from '../utils/fileDB'

const KEY = 'sit_kesiswaan'
const GAS_URL = import.meta.env.VITE_GAS_KESISWAAN_URL || ''

// SKP telah dihapus dari kategori dokumen
const JENIS_DOKUMEN = ['Ijazah SD','Ijazah SMP','Akte','Kartu Keluarga','Nilai Raport']

// Normalisasi nama jenis dokumen lama → nama standar
const NORMALISASI_JENIS = {
  'ijazah sd': 'Ijazah SD',
  'ijazah smp': 'Ijazah SMP',
  'ijazah jenjang sebelumnya dan smp': 'Ijazah SMP',
  'ijazah jenjang sebelumnya': 'Ijazah SD',
  'ijazah': 'Ijazah SD',
  'akte': 'Akte',
  'akte kelahiran': 'Akte',
  'akta': 'Akte',
  'akta kelahiran': 'Akte',
  'kartu keluarga': 'Kartu Keluarga',
  'kk': 'Kartu Keluarga',
  'nilai raport': 'Nilai Raport',
  'nilai rapor': 'Nilai Raport',
  'raport': 'Nilai Raport',
  'rapor': 'Nilai Raport',
  'skp': 'SKP',
}

function normalisasiJenis(raw) {
  if (!raw) return JENIS_DOKUMEN[0]
  const key = raw.toLowerCase().trim()
  return NORMALISASI_JENIS[key] || raw
}

// Format tanggal dari input[type=date] (yyyy-mm-dd) → dd/mm/yyyy untuk display
function formatTanggalDisplay(val) {
  if (!val) return ''
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) return val // sudah dd/mm/yyyy
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split('-')
    return `${d}/${m}/${y}`
  }
  return val
}

// Konversi dd/mm/yyyy → yyyy-mm-dd untuk value input[type=date]
function toInputDate(val) {
  if (!val) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
    const [d, m, y] = val.split('/')
    return `${y}-${m}-${d}`
  }
  return val
}

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
  { key: 'aksi',         label: 'Aksi' },
]

const EMPTY = {
  nama: '', nisn: '', nis: '', jk: '', tempatLahir: '', tanggalLahir: '',
  agama: '', alamat: '', sekolahAsal: '',
  jenisDokumen: '', keterangan: '', namaFile: '',
}

function pick(obj, ...keys) {
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && v !== '') return String(v).trim()
  }
  return ''
}

function mapRow(r) {
  const nama = pick(r, 'Nama', 'Nama Murid', 'nama')
  if (!nama || !isNaN(Number(nama))) return null
  const jkRaw = pick(r, 'JK', 'Jenis Kelamin', 'jk')
  const jk = jkRaw === 'L' ? 'Laki-laki' : jkRaw === 'P' ? 'Perempuan' : jkRaw
  const alamatBase = pick(r, 'Alamat', 'alamat')
  const kel = pick(r, 'Kelurahan', 'kelurahan')
  const kec = pick(r, 'Kecamatan', 'kecamatan')
  const alamat = [alamatBase, kel && `Kel. ${kel}`, kec && `Kec. ${kec}`].filter(Boolean).join(', ')
  return {
    id: generateId(), nama,
    nis: pick(r, 'NIS', 'nis'), nisn: pick(r, 'NISN', 'nisn'), jk,
    tempatLahir: pick(r, 'Tempat Lahir', 'Tempat_Lahir', 'tempatLahir'),
    tanggalLahir: pick(r, 'Tanggal Lahir', 'Tanggal_Lahir', 'tanggalLahir'),
    agama: pick(r, 'Agama', 'agama'), alamat,
    sekolahAsal: pick(r, 'Sekolah Asal', 'Sekolah_Asal', 'sekolahAsal'),
    jenisDokumen: normalisasiJenis(pick(r, 'Jenis Dokumen', 'jenisDokumen')),
    keterangan: pick(r, 'Keterangan', 'Catatan', 'keterangan'),
    namaFile: pick(r, 'File', 'Nama File', 'namaFile'),
    tanggalInput: pick(r, 'Tanggal Input', 'tanggalInput') || new Date().toLocaleDateString('id-ID'),
    fileUrlDrive: null,
  }
}

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onload = () => resolve(reader.result.split(',')[1])
  reader.onerror = error => reject(error)
})

export default function Kesiswaan() {
  const [data, setData] = useState(() => {
    const stored = loadFromStorage(KEY)
    return stored.map(d => ({ ...d, jenisDokumen: normalisasiJenis(d.jenisDokumen) }))
  })
  const [form, setForm]           = useState(EMPTY)
  const [pendingFile, setPending] = useState(null)
  const [pendingDocs, setPendingDocs] = useState([]) // multi-dokumen: [{ jenis, file }]
  const [modal, setModal]         = useState(null)
  const [editMode, setEditMode]   = useState(false)
  const [editForm, setEditForm]   = useState(null)
  const [editFile, setEditFile]   = useState(null)
  const [editPendingDocs, setEditPendingDocs] = useState([]) // dokumen tambahan saat edit
  const [viewer, setViewer]       = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast, showToast, closeToast } = useToast()

  useEffect(() => {
    if (!GAS_URL) return
    fetch(`${GAS_URL}?action=getData`)
      .then(r => r.json())
      .then(result => {
        if (result.success && result.rows.length > 0) {
          setData(result.rows); saveToStorage(KEY, result.rows)
        }
      })
      .catch(err => console.warn('Gagal fetch data dari GAS:', err))
  }, [])

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const fe = (k, v) => setEditForm(p => ({ ...p, [k]: v }))

  const handlePdfChange = (e) => {
    const file = e.target.files[0]; if (!file) return
    f('namaFile', file.name); setPending(file)
  }

  const handleEditFileChange = (e) => {
    const file = e.target.files[0]; if (!file) return
    setEditFile(file)
    fe('namaFile', file.name)
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
    const row = { ...form, id, tanggalLahir: formatTanggalDisplay(form.tanggalLahir), tanggalInput: new Date().toLocaleDateString('id-ID') }
    let fileBase64 = null; let fileName = null
    try {
      // Simpan dokumen utama (jika ada single file dari form lama)
      if (pendingFile) {
        fileBase64 = await fileToBase64(pendingFile)
        fileName = pendingFile.name
        await saveFile(id, pendingFile)
      }
      // Simpan multi-dokumen
      const docsMap = {}
      for (const d of pendingDocs) {
        if (!d.file) continue
        const fileId = `${id}_${d.jenis.replace(/\s+/g,'_')}`
        await saveFile(fileId, d.file)
        docsMap[d.jenis] = { namaFile: d.file.name, fileId, base64: GAS_URL ? await fileToBase64(d.file) : null }
      }
      if (!GAS_URL) {
        const next = [...data, row]; setData(next); saveToStorage(KEY, next)
        setForm(EMPTY); setPending(null); setPendingDocs([]); showToast('Data berhasil ditambahkan'); return
      }
      await fetch(GAS_URL, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'uploadRow', rowData: row, fileBase64, fileName, dokumen: docsMap }),
      })
      const next = [...data, row]; setData(next); saveToStorage(KEY, next)
      setForm(EMPTY); setPending(null); setPendingDocs([]); showToast('Data berhasil ditambahkan')
    } catch {
      const next = [...data, row]; setData(next); saveToStorage(KEY, next)
      setForm(EMPTY); setPending(null); setPendingDocs([]); showToast('Data berhasil ditambahkan')
    } finally { setIsLoading(false) }
  }

  const handleSaveEdit = async () => {
    if (!editForm.nama.trim()) return alert('Nama Murid wajib diisi.')
    if (!editForm.nis.trim())  return alert('NIS wajib diisi.')
    setIsLoading(true)
    try {
      let updatedRow = { ...editForm, tanggalLahir: formatTanggalDisplay(editForm.tanggalLahir) }
      // Ganti file utama jika ada
      if (editFile) {
        await saveFile(editForm.id, editFile)
        updatedRow.namaFile = editFile.name
      }
      // Simpan dokumen tambahan saat edit
      for (const d of editPendingDocs) {
        if (!d.file) continue
        const fileId = `${editForm.id}_${d.jenis.replace(/\s+/g,'_')}`
        await saveFile(fileId, d.file)
        // Simpan info ke field khusus per jenis
        if (!updatedRow.dokumenTambahan) updatedRow.dokumenTambahan = {}
        updatedRow.dokumenTambahan[d.jenis] = { namaFile: d.file.name, fileId }
      }
      const next = data.map(d => d.id === updatedRow.id ? updatedRow : d)
      setData(next); saveToStorage(KEY, next)
      setModal({ row: updatedRow, fileUrl: editFile ? await getFileURL(updatedRow.id) : modal.fileUrl })
      setEditMode(false); setEditFile(null); setEditPendingDocs([])
      showToast('Data berhasil diperbarui')
    } catch (err) {
      console.error(err); showToast('Gagal menyimpan perubahan', 'error')
    } finally { setIsLoading(false) }
  }

  const handleDelete = async (indices) => {
    for (const i of indices) {
      const row = data[i]
      // Hapus file lokal
      if (row?.id && row?.namaFile) await deleteFile(row.id)
      if (row?.dokumenTambahan) {
        for (const d of Object.values(row.dokumenTambahan)) {
          if (d.fileId) await deleteFile(d.fileId)
        }
      }
      // Hapus dari spreadsheet + Drive via GAS
      if (GAS_URL && row?.id) {
        fetch(GAS_URL, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'deleteRow', id: row.id }),
        }).catch(err => console.warn('Gagal hapus dari GAS:', err))
      }
    }
    const idxSet = new Set(indices)
    const next = data.filter((_, x) => !idxSet.has(x))
    setData(next); saveToStorage(KEY, next)
  }

  const handleExcel = async (rows) => {
    if (!rows.length) return alert('File Excel kosong atau format tidak dikenali.')
    const mapped = rows.map(mapRow).filter(Boolean)
    if (!mapped.length) return alert('Tidak ada data valid.')
    setIsLoading(true)
    try {
      if (!GAS_URL) {
        const next = [...data, ...mapped]; setData(next); saveToStorage(KEY, next)
        showToast('Data berhasil ditambahkan'); return
      }
      await fetch(GAS_URL, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'uploadBulk', rows: mapped }),
      })
      const next = [...data, ...mapped]; setData(next); saveToStorage(KEY, next)
      showToast('Data berhasil ditambahkan')
    } catch {
      const next = [...data, ...mapped]; setData(next); saveToStorage(KEY, next)
      showToast('Data berhasil ditambahkan')
    } finally { setIsLoading(false) }
  }

  const openDetail = async (row) => {
    let fileUrl = row.fileUrlDrive || null
    if (!fileUrl && row.id && row.namaFile) {
      try { fileUrl = await getFileURL(row.id) } catch { /* not found */ }
    }
    setModal({ row, fileUrl }); setEditMode(false); setEditFile(null)
  }

  const startEdit = () => {
    setEditForm({ ...modal.row, tanggalLahir: toInputDate(modal.row.tanggalLahir) }); setEditMode(true); setEditFile(null)
  }

  const cancelEdit = () => { setEditMode(false); setEditFile(null); setEditPendingDocs([]) }

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {JENIS_DOKUMEN.map(j => (
          <div key={j} className="card py-5 px-4">
            <p className="text-3xl font-bold text-indigo-600">{data.filter(d => d.jenisDokumen === j).length}</p>
            <p className="text-sm text-slate-500 mt-2 leading-snug font-medium">{j}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <p className="section-title">Input Data Siswa</p>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
            <div><label className="label">Nama Murid <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.nama} onChange={e => f('nama', e.target.value)} placeholder="Nama lengkap" /></div>
            <div><label className="label">NIS <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.nis} onChange={e => f('nis', e.target.value)} placeholder="Nomor Induk Siswa" /></div>
            <div><label className="label">NISN <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.nisn} onChange={e => f('nisn', e.target.value)} placeholder="Nomor Induk Siswa Nasional" /></div>
            <div><label className="label">Jenis Kelamin <span className="text-rose-400 normal-case">*</span></label>
              <select className="input" value={form.jk} onChange={e => f('jk', e.target.value)}>
                <option value="">-- Pilih Jenis Kelamin --</option>
                <option>Laki-laki</option><option>Perempuan</option>
              </select></div>
            <div><label className="label">Tempat Lahir <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.tempatLahir} onChange={e => f('tempatLahir', e.target.value)} placeholder="Kota tempat lahir" /></div>
            <div><label className="label">Tanggal Lahir <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" type="date" value={form.tanggalLahir} onChange={e => f('tanggalLahir', e.target.value)} /></div>
            <div><label className="label">Agama <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.agama} onChange={e => f('agama', e.target.value)} placeholder="Agama" /></div>
            <div className="sm:col-span-2"><label className="label">Alamat <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.alamat} onChange={e => f('alamat', e.target.value)} placeholder="Alamat lengkap" /></div>
            <div><label className="label">Sekolah Asal <span className="text-rose-400 normal-case">*</span></label>
              <input className="input" value={form.sekolahAsal} onChange={e => f('sekolahAsal', e.target.value)} placeholder="Nama sekolah asal" /></div>
            <div><label className="label">Jenis Dokumen <span className="text-rose-400 normal-case">*</span></label>
              <select className="input" value={form.jenisDokumen} onChange={e => f('jenisDokumen', e.target.value)}>
                <option value="">-- Silahkan Pilih Jenis Dokumen --</option>
                {JENIS_DOKUMEN.map(j => <option key={j}>{j}</option>)}
              </select></div>
            <div><label className="label">Keterangan</label>
              <input className="input" value={form.keterangan} onChange={e => f('keterangan', e.target.value)} placeholder="Opsional" /></div>
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Upload Dokumen (PDF)</label>
                <button type="button" onClick={() => setPendingDocs(p => [...p, { jenis: JENIS_DOKUMEN[0], file: null }])}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold border border-indigo-300 px-3 py-1 rounded-lg">
                  + Tambah Dokumen
                </button>
              </div>
              {pendingDocs.length === 0 && (
                <p className="text-xs text-slate-400 italic">Klik "+ Tambah Dokumen" untuk upload file PDF per jenis dokumen</p>
              )}
              <div className="space-y-2">
                {pendingDocs.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 flex-wrap bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <select className="input w-44 py-1.5 text-sm flex-shrink-0"
                      value={d.jenis}
                      onChange={e => setPendingDocs(p => p.map((x, idx) => idx === i ? { ...x, jenis: e.target.value } : x))}>
                      {JENIS_DOKUMEN.map(j => <option key={j}>{j}</option>)}
                    </select>
                    <label className="cursor-pointer flex-1 min-w-0 border border-dashed border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-sm px-4 py-2 rounded-xl transition truncate">
                      {d.file ? d.file.name : 'Pilih File PDF'}
                      <input type="file" accept=".pdf" className="hidden"
                        onChange={e => { const file = e.target.files[0]; if (file) setPendingDocs(p => p.map((x, idx) => idx === i ? { ...x, file } : x)) }} />
                    </label>
                    <button type="button" onClick={() => setPendingDocs(p => p.filter((_, idx) => idx !== i))}
                      className="text-rose-400 hover:text-rose-600 text-xl leading-none font-bold flex-shrink-0">&times;</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
            <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? 'Menyimpan...' : 'Simpan'}</button>
            <div className={isLoading ? "pointer-events-none opacity-60" : ""}><ExcelUpload onData={handleExcel} /></div>
            <button type="button" onClick={() => { setForm(EMPTY); setPending(null); setPendingDocs([]) }} className="btn-secondary">Reset</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="section-title mb-0">Arsip Data Siswa</p>
          <span className="text-xs text-slate-400">{data.length} total</span>
        </div>
        <DataTable columns={COLUMNS} data={data} onDelete={handleDelete} renderCell={renderCell} />
      </div>

      {/* Detail / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl border border-slate-200 shadow-xl my-8">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editMode ? 'Edit Data Siswa' : 'Detail Dokumen Siswa'}</h3>
              <button onClick={() => { setModal(null); setEditMode(false) }} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>

            {editMode && editForm ? (
              <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="label">Nama Murid</label>
                  <input className="input" value={editForm.nama} onChange={e => fe('nama', e.target.value)} /></div>
                <div><label className="label">NIS</label>
                  <input className="input" value={editForm.nis} onChange={e => fe('nis', e.target.value)} /></div>
                <div><label className="label">NISN</label>
                  <input className="input" value={editForm.nisn} onChange={e => fe('nisn', e.target.value)} /></div>
                <div><label className="label">Jenis Kelamin</label>
                  <select className="input" value={editForm.jk} onChange={e => fe('jk', e.target.value)}>
                    <option value="">-- Pilih --</option>
                    <option>Laki-laki</option><option>Perempuan</option>
                  </select></div>
                <div><label className="label">Tempat Lahir</label>
                  <input className="input" value={editForm.tempatLahir} onChange={e => fe('tempatLahir', e.target.value)} /></div>
                <div><label className="label">Tanggal Lahir</label>
                  <input className="input" type="date" value={editForm.tanggalLahir} onChange={e => fe('tanggalLahir', e.target.value)} /></div>
                <div><label className="label">Agama</label>
                  <input className="input" value={editForm.agama} onChange={e => fe('agama', e.target.value)} /></div>
                <div><label className="label">Sekolah Asal</label>
                  <input className="input" value={editForm.sekolahAsal} onChange={e => fe('sekolahAsal', e.target.value)} /></div>
                <div className="sm:col-span-2"><label className="label">Alamat</label>
                  <input className="input" value={editForm.alamat} onChange={e => fe('alamat', e.target.value)} /></div>
                <div><label className="label">Jenis Dokumen</label>
                  <select className="input" value={editForm.jenisDokumen} onChange={e => fe('jenisDokumen', e.target.value)}>
                    {JENIS_DOKUMEN.map(j => <option key={j}>{j}</option>)}
                  </select></div>
                <div><label className="label">Keterangan</label>
                  <input className="input" value={editForm.keterangan} onChange={e => fe('keterangan', e.target.value)} /></div>
                <div className="sm:col-span-2">
                  <label className="label">Upload / Ganti Dokumen (PDF)</label>
                  <div className="space-y-2 mb-2">
                    {/* File utama (namaFile) */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-slate-500 w-36 flex-shrink-0">{editForm.jenisDokumen || 'Dokumen Utama'}</span>
                      <label className="cursor-pointer border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm px-4 py-2.5 rounded-xl transition flex-1">
                        {editFile ? editFile.name : (editForm.namaFile ? `Ganti: ${editForm.namaFile}` : 'Pilih File PDF')}
                        <input type="file" accept=".pdf" className="hidden" onChange={handleEditFileChange} />
                      </label>
                      {editFile && <span className="text-xs text-emerald-600 font-medium">Baru</span>}
                    </div>
                  </div>
                  {/* Dokumen tambahan per jenis */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">Dokumen jenis lain</span>
                    <button type="button"
                      onClick={() => setEditPendingDocs(p => [...p, { jenis: JENIS_DOKUMEN[0], file: null }])}
                      className="text-xs text-indigo-600 border border-indigo-300 px-3 py-1 rounded-lg font-semibold">
                      + Dokumen Baru
                    </button>
                  </div>
                  {/* Dokumen tambahan existing */}
                  {editForm.dokumenTambahan && Object.entries(editForm.dokumenTambahan).map(([jenis, doc]) => (
                    <div key={jenis} className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 mb-2 text-sm">
                      <span className="font-medium text-indigo-700 w-36 flex-shrink-0">{jenis}</span>
                      <span className="text-slate-500 flex-1 truncate">{doc.namaFile}</span>
                    </div>
                  ))}
                  <div className="space-y-2">
                    {editPendingDocs.map((d, i) => (
                      <div key={i} className="flex items-center gap-3 flex-wrap bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                        <select className="input w-44 py-1.5 text-sm flex-shrink-0" value={d.jenis}
                          onChange={e => setEditPendingDocs(p => p.map((x, idx) => idx === i ? { ...x, jenis: e.target.value } : x))}>
                          {JENIS_DOKUMEN.map(j => <option key={j}>{j}</option>)}
                        </select>
                        <label className="cursor-pointer flex-1 min-w-0 border border-dashed border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-sm px-4 py-2 rounded-xl transition truncate">
                          {d.file ? d.file.name : 'Pilih File PDF'}
                          <input type="file" accept=".pdf" className="hidden"
                            onChange={e => { const file = e.target.files[0]; if (file) setEditPendingDocs(p => p.map((x, idx) => idx === i ? { ...x, file } : x)) }} />
                        </label>
                        <button type="button" onClick={() => setEditPendingDocs(p => p.filter((_, idx) => idx !== i))}
                          className="text-rose-400 hover:text-rose-600 text-xl leading-none font-bold">&times;</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-3">
                  {[
                    ['Nama Murid', modal.row.nama], ['NIS', modal.row.nis],
                    ['NISN', modal.row.nisn], ['Jenis Kelamin', modal.row.jk],
                    ['Tempat Lahir', modal.row.tempatLahir], ['Tanggal Lahir', modal.row.tanggalLahir],
                    ['Agama', modal.row.agama], ['Sekolah Asal', modal.row.sekolahAsal],
                    ['Jenis Dokumen', modal.row.jenisDokumen], ['Keterangan', modal.row.keterangan],
                    ['Tanggal Input', modal.row.tanggalInput], ['File', modal.row.namaFile || '-'],
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
                      {modal.row.fileUrlDrive ? 'Tautan Dokumen (Google Drive)' : 'Pratinjau Dokumen'}
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
                {/* Dokumen tambahan per jenis */}
                {modal.row.dokumenTambahan && Object.entries(modal.row.dokumenTambahan).length > 0 && (
                  <div className="px-6 pb-4">
                    <p className="text-xs text-slate-400 mb-2">Dokumen Tambahan</p>
                    <div className="space-y-2">
                      {Object.entries(modal.row.dokumenTambahan).map(([jenis, doc]) => (
                        <DokumenTambahanItem key={jenis} jenis={jenis} doc={doc} onView={url => setViewer(url)} />
                      ))}
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
                  {modal.fileUrl && !modal.row.fileUrlDrive && (
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

// Helper: tampilkan satu item dokumen tambahan di modal detail
function DokumenTambahanItem({ jenis, doc, onView }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (doc.fileId) getFileURL(doc.fileId).then(setUrl).catch(() => {})
  }, [doc.fileId])
  return (
    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5 text-sm">
      <span className="font-medium text-indigo-700 w-36 flex-shrink-0">{jenis}</span>
      <span className="text-slate-500 flex-1 truncate">{doc.namaFile || '-'}</span>
      {url && <button onClick={() => onView(url)} className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline flex-shrink-0">Lihat</button>}
    </div>
  )
}
