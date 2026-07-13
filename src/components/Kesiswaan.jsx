import { useState, useEffect } from 'react'
import DataTable from './DataTable'
import ExcelUpload from './ExcelUpload'
import Toast, { useToast } from './Toast'
import { saveToStorage, loadFromStorage, generateId } from '../utils/storage'
import { saveFile, getFileURL, deleteFile } from '../utils/fileDB'

const KEY = 'sit_kesiswaan'
const GAS_URL = import.meta.env.VITE_GAS_KESISWAAN_URL || ''

const JENIS_DOKUMEN = ['Ijazah SD','Ijazah SMP','Akte','Kartu Keluarga','Nilai Raport']

const NORMALISASI_JENIS = {
  'ijazah sd':'Ijazah SD','ijazah smp':'Ijazah SMP',
  'ijazah jenjang sebelumnya dan smp':'Ijazah SMP','ijazah jenjang sebelumnya':'Ijazah SD','ijazah':'Ijazah SD',
  'akte':'Akte','akte kelahiran':'Akte','akta':'Akte','akta kelahiran':'Akte',
  'kartu keluarga':'Kartu Keluarga','kk':'Kartu Keluarga',
  'nilai raport':'Nilai Raport','nilai rapor':'Nilai Raport','raport':'Nilai Raport','rapor':'Nilai Raport',
  'skp':'SKP',
}
const normJenis = (raw) => { if (!raw) return ''; const k = raw.toLowerCase().trim(); return NORMALISASI_JENIS[k] || raw }

// Format yyyy-mm-dd → dd/mm/yyyy
const fmtDisplay = (v) => {
  if (!v) return ''
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return v
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y,m,d]=v.split('-'); return `${d}/${m}/${y}` }
  return v
}
// Format dd/mm/yyyy → yyyy-mm-dd untuk input[type=date]
const fmtInput = (v) => {
  if (!v) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) { const [d,m,y]=v.split('/'); return `${y}-${m}-${d}` }
  return v
}

const COLUMNS = [
  { key:'nama', label:'Nama Murid' }, { key:'nis', label:'NIS' }, { key:'nisn', label:'NISN' },
  { key:'jk', label:'JK' }, { key:'tempatLahir', label:'Tempat Lahir' },
  { key:'tanggalLahir', label:'Tgl Lahir' }, { key:'agama', label:'Agama' },
  { key:'sekolahAsal', label:'Sekolah Asal' }, { key:'dokumenList', label:'Dokumen' },
  { key:'aksi', label:'Aksi' },
]

const EMPTY = { nama:'', nisn:'', nis:'', jk:'', tempatLahir:'', tanggalLahir:'', agama:'', alamat:'', sekolahAsal:'', keterangan:'' }

function pick(obj,...keys) { for (const k of keys) { const v=obj[k]; if (v!==undefined&&v!=='') return String(v).trim() } return '' }

// Migrasi baris lama (flat namaFile+jenisDokumen) → format baru (dokumen: {})
function migrateRow(d) {
  if (d.dokumen && typeof d.dokumen === 'object') {
    return { ...d, tanggalLahir: fmtDisplay(d.tanggalLahir) }
  }
  const dokumen = {}
  const jenis = normJenis(d.jenisDokumen || '')
  if (jenis && (d.namaFile || d.fileUrlDrive)) {
    dokumen[jenis] = { namaFile: d.namaFile || '', urlDrive: d.fileUrlDrive || '', fileId: d.id }
  }
  return { ...d, dokumen, tanggalLahir: fmtDisplay(d.tanggalLahir) }
}

function mapRow(r) {
  const nama = pick(r,'Nama','Nama Murid','nama')
  if (!nama || !isNaN(Number(nama))) return null
  const jkRaw = pick(r,'JK','Jenis Kelamin','jk')
  const jk = jkRaw==='L'?'Laki-laki':jkRaw==='P'?'Perempuan':jkRaw
  const al = pick(r,'Alamat','alamat')
  const kel = pick(r,'Kelurahan','kelurahan')
  const kec = pick(r,'Kecamatan','kecamatan')
  const alamat = [al, kel&&`Kel. ${kel}`, kec&&`Kec. ${kec}`].filter(Boolean).join(', ')
  const jenis = normJenis(pick(r,'Jenis Dokumen','jenisDokumen'))
  const namaFile = pick(r,'File','Nama File','namaFile')
  const dokumen = jenis ? { [jenis]: { namaFile, urlDrive:'', fileId:null } } : {}
  return {
    id:generateId(), nama,
    nis:pick(r,'NIS','nis'), nisn:pick(r,'NISN','nisn'), jk,
    tempatLahir:pick(r,'Tempat Lahir','Tempat_Lahir','tempatLahir'),
    tanggalLahir:fmtDisplay(pick(r,'Tanggal Lahir','Tanggal_Lahir','tanggalLahir')),
    agama:pick(r,'Agama','agama'), alamat,
    sekolahAsal:pick(r,'Sekolah Asal','Sekolah_Asal','sekolahAsal'),
    keterangan:pick(r,'Keterangan','Catatan','keterangan'),
    dokumen,
    tanggalInput:pick(r,'Tanggal Input','tanggalInput')||new Date().toLocaleDateString('id-ID'),
  }
}

const toB64 = (file) => new Promise((res,rej) => {
  const r = new FileReader(); r.readAsDataURL(file)
  r.onload = () => res(r.result.split(',')[1]); r.onerror = rej
})

export default function Kesiswaan() {
  const [data, setData]     = useState(() => loadFromStorage(KEY).map(migrateRow))
  const [form, setForm]     = useState(EMPTY)
  const [newDocs, setNewDocs] = useState([])   // [{ jenis, file }] untuk form input baru
  const [modal, setModal]   = useState(null)   // { row }
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState(null) // copy row saat edit
  const [editDocs, setEditDocs] = useState([])   // [{ jenis, file }] dokumen baru saat edit
  const [viewer, setViewer] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast, showToast, closeToast } = useToast()

  useEffect(() => {
    if (!GAS_URL) return
    fetch(`${GAS_URL}?action=getData`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.rows.length > 0) {
          const migrated = res.rows.map(migrateRow)
          setData(migrated); saveToStorage(KEY, migrated)
        }
      })
      .catch(e => console.warn('GAS getData error:', e))
  }, [])

  const f = (k,v) => setForm(p => ({...p,[k]:v}))
  const fe = (k,v) => setEditForm(p => ({...p,[k]:v}))

  // ── SUBMIT BARU ──
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nama.trim())                  return alert('Nama Murid wajib diisi.')
    if (!form.nis.trim())                   return alert('NIS wajib diisi.')
    if (!/^\d{10}$/.test(form.nis.trim()))  return alert('NIS harus 10 digit angka.')
    if (!form.nisn.trim())                  return alert('NISN wajib diisi.')
    if (!/^\d{10}$/.test(form.nisn.trim())) return alert('NISN harus 10 digit angka.')
    if (!form.jk)       return alert('Jenis Kelamin wajib dipilih.')
    if (!form.tempatLahir.trim()) return alert('Tempat Lahir wajib diisi.')
    if (!form.tanggalLahir)       return alert('Tanggal Lahir wajib diisi.')
    if (!form.agama.trim())       return alert('Agama wajib diisi.')
    if (!form.alamat.trim())      return alert('Alamat wajib diisi.')
    if (!form.sekolahAsal.trim()) return alert('Sekolah Asal wajib diisi.')

    setIsLoading(true)
    const id = generateId()
    const dokumen = {}
    const gasDocsMap = {}

    for (const d of newDocs) {
      if (!d.file) continue
      const fileId = `${id}_${d.jenis.replace(/\s+/g,'_')}`
      await saveFile(fileId, d.file)
      dokumen[d.jenis] = { namaFile: d.file.name, urlDrive:'', fileId }
      if (GAS_URL) gasDocsMap[d.jenis] = { fileName: d.file.name, base64: await toB64(d.file) }
    }

    const row = { ...form, id, tanggalLahir: fmtDisplay(form.tanggalLahir), dokumen, tanggalInput: new Date().toLocaleDateString('id-ID') }
    try {
      if (GAS_URL) {
        await fetch(GAS_URL, {
          method:'POST', mode:'no-cors',
          headers:{'Content-Type':'text/plain;charset=utf-8'},
          body: JSON.stringify({ action:'uploadRow', rowData:row, dokumen:gasDocsMap }),
        })
      }
      const next = [...data, row]; setData(next); saveToStorage(KEY, next)
      setForm(EMPTY); setNewDocs([]); showToast('Data berhasil ditambahkan')
    } catch {
      const next = [...data, row]; setData(next); saveToStorage(KEY, next)
      setForm(EMPTY); setNewDocs([]); showToast('Data berhasil ditambahkan')
    } finally { setIsLoading(false) }
  }

  // ── SAVE EDIT ──
  const handleSaveEdit = async () => {
    if (!editForm.nama.trim()) return alert('Nama Murid wajib diisi.')
    if (!editForm.nis.trim())  return alert('NIS wajib diisi.')
    setIsLoading(true)
    try {
      // Mulai dari dokumen yang sudah ada di editForm
      const mergedDokumen = { ...(editForm.dokumen || {}) }
      const gasDocsMap = {}

      // Tambahkan / timpa dengan dokumen baru yang di-upload
      for (const d of editDocs) {
        if (!d.file) continue
        const fileId = `${editForm.id}_${d.jenis.replace(/\s+/g,'_')}`
        await saveFile(fileId, d.file)
        mergedDokumen[d.jenis] = { namaFile: d.file.name, urlDrive:'', fileId }
        if (GAS_URL) gasDocsMap[d.jenis] = { fileName: d.file.name, base64: await toB64(d.file) }
      }

      const updatedRow = { ...editForm, tanggalLahir: fmtDisplay(editForm.tanggalLahir), dokumen: mergedDokumen }
      const next = data.map(d => d.id === updatedRow.id ? updatedRow : d)
      setData(next); saveToStorage(KEY, next)

      if (GAS_URL && Object.keys(gasDocsMap).length > 0) {
        fetch(GAS_URL, {
          method:'POST', mode:'no-cors',
          headers:{'Content-Type':'text/plain;charset=utf-8'},
          body: JSON.stringify({ action:'updateRow', rowData:updatedRow, dokumen:gasDocsMap }),
        }).catch(e => console.warn('GAS updateRow error:', e))
      }

      setModal({ row: updatedRow }); setEditMode(false); setEditDocs([])
      showToast('Data berhasil diperbarui')
    } catch (err) {
      console.error(err); showToast('Gagal menyimpan', 'error')
    } finally { setIsLoading(false) }
  }

  // ── DELETE ──
  const handleDelete = async (indices) => {
    for (const i of indices) {
      const row = data[i]
      if (row?.dokumen) {
        for (const d of Object.values(row.dokumen)) {
          if (d.fileId) await deleteFile(d.fileId).catch(() => {})
        }
      }
      if (GAS_URL && row?.id) {
        fetch(GAS_URL, {
          method:'POST', mode:'no-cors',
          headers:{'Content-Type':'text/plain;charset=utf-8'},
          body: JSON.stringify({ action:'deleteRow', id: row.id }),
        }).catch(() => {})
      }
    }
    const s = new Set(indices)
    const next = data.filter((_,x) => !s.has(x))
    setData(next); saveToStorage(KEY, next)
  }

  // ── EXCEL ──
  const handleExcel = async (rows) => {
    if (!rows.length) return alert('File Excel kosong.')
    const mapped = rows.map(mapRow).filter(Boolean)
    if (!mapped.length) return alert('Tidak ada data valid.')
    setIsLoading(true)
    try {
      if (GAS_URL) {
        await fetch(GAS_URL, {
          method:'POST', mode:'no-cors',
          headers:{'Content-Type':'text/plain;charset=utf-8'},
          body: JSON.stringify({ action:'uploadBulk', rows: mapped }),
        })
      }
      const next = [...data, ...mapped]; setData(next); saveToStorage(KEY, next)
      showToast('Data berhasil ditambahkan')
    } catch {
      const next = [...data, ...mapped]; setData(next); saveToStorage(KEY, next)
      showToast('Data berhasil ditambahkan')
    } finally { setIsLoading(false) }
  }

  const openDetail = (row) => { setModal({ row }); setEditMode(false); setEditDocs([]) }
  const startEdit  = () => {
    setEditForm({ ...modal.row, tanggalLahir: fmtInput(modal.row.tanggalLahir) })
    setEditMode(true); setEditDocs([])
  }
  const cancelEdit = () => { setEditMode(false); setEditDocs([]) }

  const renderCell = (col, row) => {
    if (col.key === 'aksi') return (
      <button onClick={() => openDetail(row)} className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline underline-offset-2">Lihat Detail</button>
    )
    if (col.key === 'dokumenList') {
      const keys = Object.keys(row.dokumen || {})
      return keys.length ? <span className="text-xs">{keys.join(', ')}</span> : <span className="text-slate-400 text-xs">-</span>
    }
    if (col.key === 'jk') return row.jk || '-'
    return row[col.key] || '-'
  }

  return (
    <div className="space-y-6 max-w-screen-xl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {JENIS_DOKUMEN.map(j => (
          <div key={j} className="card py-5 px-4">
            <p className="text-3xl font-bold text-indigo-600">{data.filter(d => d.dokumen && d.dokumen[j]).length}</p>
            <p className="text-sm text-slate-500 mt-2 font-medium">{j}</p>
          </div>
        ))}
      </div>

      {/* Form Input */}
      <div className="card">
        <p className="section-title">Input Data Siswa</p>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
            <div><label className="label">Nama Murid *</label><input className="input" value={form.nama} onChange={e=>f('nama',e.target.value)} placeholder="Nama lengkap" /></div>
            <div><label className="label">NIS *</label><input className="input" value={form.nis} onChange={e=>f('nis',e.target.value)} placeholder="10 digit" /></div>
            <div><label className="label">NISN *</label><input className="input" value={form.nisn} onChange={e=>f('nisn',e.target.value)} placeholder="10 digit" /></div>
            <div><label className="label">Jenis Kelamin *</label>
              <select className="input" value={form.jk} onChange={e=>f('jk',e.target.value)}>
                <option value="">-- Pilih --</option><option>Laki-laki</option><option>Perempuan</option>
              </select></div>
            <div><label className="label">Tempat Lahir *</label><input className="input" value={form.tempatLahir} onChange={e=>f('tempatLahir',e.target.value)} /></div>
            <div><label className="label">Tanggal Lahir *</label><input className="input" type="date" value={form.tanggalLahir} onChange={e=>f('tanggalLahir',e.target.value)} /></div>
            <div><label className="label">Agama *</label><input className="input" value={form.agama} onChange={e=>f('agama',e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="label">Alamat *</label><input className="input" value={form.alamat} onChange={e=>f('alamat',e.target.value)} /></div>
            <div><label className="label">Sekolah Asal *</label><input className="input" value={form.sekolahAsal} onChange={e=>f('sekolahAsal',e.target.value)} /></div>
            <div><label className="label">Keterangan</label><input className="input" value={form.keterangan} onChange={e=>f('keterangan',e.target.value)} placeholder="Opsional" /></div>
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Upload Dokumen (PDF)</label>
                <button type="button" onClick={() => setNewDocs(p=>[...p,{jenis:JENIS_DOKUMEN[0],file:null}])}
                  className="text-xs text-indigo-600 border border-indigo-300 px-3 py-1 rounded-lg font-semibold">+ Tambah Dokumen</button>
              </div>
              {newDocs.length===0 && <p className="text-xs text-slate-400 italic">Klik "+ Tambah Dokumen" untuk upload PDF per jenis</p>}
              <div className="space-y-2">
                {newDocs.map((d,i) => (
                  <div key={i} className="flex items-center gap-3 flex-wrap bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <select className="input w-44 py-1.5 text-sm flex-shrink-0" value={d.jenis}
                      onChange={e => setNewDocs(p=>p.map((x,idx)=>idx===i?{...x,jenis:e.target.value}:x))}>
                      {JENIS_DOKUMEN.map(j=><option key={j}>{j}</option>)}
                    </select>
                    <label className="cursor-pointer flex-1 min-w-0 border border-dashed border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-sm px-4 py-2 rounded-xl transition truncate">
                      {d.file ? d.file.name : 'Pilih File PDF'}
                      <input type="file" accept=".pdf" className="hidden"
                        onChange={e=>{const file=e.target.files[0];if(file)setNewDocs(p=>p.map((x,idx)=>idx===i?{...x,file}:x))}} />
                    </label>
                    <button type="button" onClick={()=>setNewDocs(p=>p.filter((_,idx)=>idx!==i))} className="text-rose-400 hover:text-rose-600 text-xl font-bold">&times;</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
            <button type="submit" disabled={isLoading} className="btn-primary">{isLoading?'Menyimpan...':'Simpan'}</button>
            <div className={isLoading?"pointer-events-none opacity-60":""}><ExcelUpload onData={handleExcel} /></div>
            <button type="button" onClick={()=>{setForm(EMPTY);setNewDocs([])}} className="btn-secondary">Reset</button>
          </div>
        </form>
      </div>

      {/* Tabel */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="section-title mb-0">Arsip Data Siswa</p>
          <span className="text-xs text-slate-400">{data.length} total</span>
        </div>
        <DataTable columns={COLUMNS} data={data} onDelete={handleDelete} renderCell={renderCell} />
      </div>

      {/* Modal Detail / Edit */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl border border-slate-200 shadow-xl my-8">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editMode ? 'Edit Data Siswa' : 'Detail Dokumen Siswa'}</h3>
              <button onClick={()=>{setModal(null);setEditMode(false)}} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>

            {editMode && editForm ? (
              <div className="px-6 py-5 space-y-4">
                {/* Fields data siswa */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="label">Nama Murid</label><input className="input" value={editForm.nama} onChange={e=>fe('nama',e.target.value)} /></div>
                  <div><label className="label">NIS</label><input className="input" value={editForm.nis} onChange={e=>fe('nis',e.target.value)} /></div>
                  <div><label className="label">NISN</label><input className="input" value={editForm.nisn} onChange={e=>fe('nisn',e.target.value)} /></div>
                  <div><label className="label">Jenis Kelamin</label>
                    <select className="input" value={editForm.jk} onChange={e=>fe('jk',e.target.value)}>
                      <option value="">-- Pilih --</option><option>Laki-laki</option><option>Perempuan</option>
                    </select></div>
                  <div><label className="label">Tempat Lahir</label><input className="input" value={editForm.tempatLahir} onChange={e=>fe('tempatLahir',e.target.value)} /></div>
                  <div><label className="label">Tanggal Lahir</label><input className="input" type="date" value={editForm.tanggalLahir} onChange={e=>fe('tanggalLahir',e.target.value)} /></div>
                  <div><label className="label">Agama</label><input className="input" value={editForm.agama} onChange={e=>fe('agama',e.target.value)} /></div>
                  <div><label className="label">Sekolah Asal</label><input className="input" value={editForm.sekolahAsal} onChange={e=>fe('sekolahAsal',e.target.value)} /></div>
                  <div className="sm:col-span-2"><label className="label">Alamat</label><input className="input" value={editForm.alamat} onChange={e=>fe('alamat',e.target.value)} /></div>
                  <div className="sm:col-span-2"><label className="label">Keterangan</label><input className="input" value={editForm.keterangan} onChange={e=>fe('keterangan',e.target.value)} /></div>
                </div>

                {/* Dokumen yang sudah tersimpan */}
                {Object.keys(editForm.dokumen||{}).length > 0 && (
                  <div>
                    <p className="label mb-2">Dokumen Tersimpan</p>
                    <div className="space-y-2">
                      {Object.entries(editForm.dokumen).map(([jenis, doc]) => (
                        <div key={jenis} className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
                          <span className="text-sm font-medium text-indigo-700 w-36 flex-shrink-0">{jenis}</span>
                          <span className="text-sm text-slate-500 flex-1 truncate">{doc.namaFile || 'Tidak ada file'}</span>
                          {(doc.urlDrive) && (
                            <a href={doc.urlDrive} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 underline flex-shrink-0">Drive</a>
                          )}
                          <button type="button"
                            onClick={() => { const d={...editForm.dokumen}; delete d[jenis]; fe('dokumen',d) }}
                            className="text-rose-400 hover:text-rose-600 text-lg leading-none flex-shrink-0">&times;</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload dokumen baru */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="label mb-0">Tambah / Ganti Dokumen</p>
                    <button type="button" onClick={()=>setEditDocs(p=>[...p,{jenis:JENIS_DOKUMEN[0],file:null}])}
                      className="text-xs text-indigo-600 border border-indigo-300 px-3 py-1 rounded-lg font-semibold">+ Dokumen Baru</button>
                  </div>
                  {editDocs.length===0 && <p className="text-xs text-slate-400 italic">Klik "+ Dokumen Baru" untuk upload atau ganti dokumen per jenis</p>}
                  <div className="space-y-2">
                    {editDocs.map((d,i) => (
                      <div key={i} className="flex items-center gap-3 flex-wrap bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                        <select className="input w-44 py-1.5 text-sm flex-shrink-0" value={d.jenis}
                          onChange={e=>setEditDocs(p=>p.map((x,idx)=>idx===i?{...x,jenis:e.target.value}:x))}>
                          {JENIS_DOKUMEN.map(j=><option key={j}>{j}</option>)}
                        </select>
                        <label className="cursor-pointer flex-1 min-w-0 border border-dashed border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-sm px-4 py-2 rounded-xl transition truncate">
                          {d.file ? d.file.name : 'Pilih File PDF'}
                          <input type="file" accept=".pdf" className="hidden"
                            onChange={e=>{const file=e.target.files[0];if(file)setEditDocs(p=>p.map((x,idx)=>idx===i?{...x,file}:x))}} />
                        </label>
                        <button type="button" onClick={()=>setEditDocs(p=>p.filter((_,idx)=>idx!==i))} className="text-rose-400 hover:text-rose-600 text-xl font-bold">&times;</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            ) : (
              /* View mode */
              <div className="px-6 py-5">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-5">
                  {[['Nama Murid',modal.row.nama],['NIS',modal.row.nis],['NISN',modal.row.nisn],
                    ['Jenis Kelamin',modal.row.jk],['Tempat Lahir',modal.row.tempatLahir],
                    ['Tanggal Lahir',modal.row.tanggalLahir],['Agama',modal.row.agama],
                    ['Sekolah Asal',modal.row.sekolahAsal],['Keterangan',modal.row.keterangan],
                    ['Tanggal Input',modal.row.tanggalInput],
                  ].map(([k,v])=>(
                    <div key={k} className="text-sm"><p className="text-slate-400 text-xs mb-0.5">{k}</p><p className="text-slate-800 font-medium break-words">{v||'-'}</p></div>
                  ))}
                  <div className="col-span-2 text-sm"><p className="text-slate-400 text-xs mb-0.5">Alamat</p><p className="text-slate-800 font-medium">{modal.row.alamat||'-'}</p></div>
                </div>

                {/* Daftar dokumen */}
                <p className="text-xs font-medium text-slate-400 mb-2">Dokumen</p>
                {Object.keys(modal.row.dokumen||{}).length === 0 ? (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl py-5 text-center text-sm text-slate-400">Belum ada dokumen.</div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(modal.row.dokumen).map(([jenis,doc]) => (
                      <ViewDocItem key={jenis} jenis={jenis} doc={doc} onView={url=>setViewer(url)} />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="px-6 pb-6 mt-2 flex gap-2">
              {editMode ? (
                <>
                  <button onClick={handleSaveEdit} disabled={isLoading} className="btn-primary flex-1">{isLoading?'Menyimpan...':'Simpan Perubahan'}</button>
                  <button onClick={cancelEdit} className="btn-secondary flex-1">Batal</button>
                </>
              ) : (
                <>
                  <button onClick={startEdit} className="btn-primary flex-1">Edit Data</button>
                  <button onClick={()=>setModal(null)} className="btn-secondary flex-1">Tutup</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full screen viewer */}
      {viewer && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900">
            <p className="text-white text-sm font-medium">Dokumen</p>
            <button onClick={()=>setViewer(null)} className="text-white hover:text-slate-300 text-2xl leading-none">&times;</button>
          </div>
          <iframe src={viewer} className="flex-1 w-full" title="Dokumen" />
        </div>
      )}
    </div>
  )
}

// Komponen tampil satu baris dokumen di view mode
function ViewDocItem({ jenis, doc, onView }) {
  const [url, setUrl] = useState(doc.urlDrive || null)
  useEffect(() => {
    if (!doc.urlDrive && doc.fileId) {
      getFileURL(doc.fileId).then(setUrl).catch(()=>{})
    }
  }, [doc])
  return (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
      <span className="text-sm font-medium text-slate-700 w-36 flex-shrink-0">{jenis}</span>
      <span className="text-sm text-slate-500 flex-1 truncate">{doc.namaFile || '-'}</span>
      {url && !doc.urlDrive && (
        <button onClick={()=>onView(url)} className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline flex-shrink-0">Lihat</button>
      )}
      {doc.urlDrive && (
        <a href={doc.urlDrive} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold underline flex-shrink-0">Drive</a>
      )}
    </div>
  )
}
