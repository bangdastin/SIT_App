const ROOT_FOLDER_ID   = '14n26CyPHcq4u9Vo3cQkA2a9nvGTvv5ih'
const MASTER_FILE_NAME = 'Data_Kesiswaan'

// Header utama siswa — tiap jenis dokumen dapat kolom sendiri
const JENIS_DOKUMEN_LIST = ['Ijazah SD','Ijazah SMP','Akte','Kartu Keluarga','Nilai Raport']

const BASE_HEADERS = [
  'ID','Nama Murid','NIS','NISN','JK','Tempat Lahir',
  'Tanggal Lahir','Agama','Alamat','Sekolah Asal','Keterangan','Tanggal Input'
]

// Header lengkap: base + per jenis dokumen (nama file + url drive)
function getFullHeaders() {
  const h = [...BASE_HEADERS]
  for (const j of JENIS_DOKUMEN_LIST) {
    h.push(`File ${j}`)
    h.push(`URL ${j}`)
  }
  return h
}

function formatTanggal(val) {
  if (!val) return ''
  const s = String(val)
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) return s.replace(/-/g, '/')
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s)
    if (!isNaN(d)) return d.toLocaleDateString('id-ID')
  }
  const d = new Date(val)
  if (!isNaN(d)) return d.toLocaleDateString('id-ID')
  return s
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents)
    let result
    if      (payload.action === 'uploadRow')   result = handleUploadRow(payload)
    else if (payload.action === 'uploadBulk')  result = handleUploadBulk(payload)
    else if (payload.action === 'updateRow')   result = handleUpdateRow(payload)
    else if (payload.action === 'deleteRow')   result = handleDeleteRow(payload)
    else result = { success: false, error: 'Action tidak dikenal' }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON)
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON)
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'getData') {
    try {
      const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)
      const sheet = getOrCreateMasterSheet(rootFolder)
      const lastRow = sheet.getLastRow()
      if (lastRow <= 1) return jsonResponse({ success: true, rows: [] })

      const headers = getFullHeaders()
      const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues()

      const rows = values.map(r => {
        const obj = {
          id:           String(r[0]||''),
          nama:         String(r[1]||''),
          nis:          String(r[2]||''),
          nisn:         String(r[3]||''),
          jk:           String(r[4]||''),
          tempatLahir:  String(r[5]||''),
          tanggalLahir: formatTanggal(r[6]),
          agama:        String(r[7]||''),
          alamat:       String(r[8]||''),
          sekolahAsal:  String(r[9]||''),
          keterangan:   String(r[10]||''),
          tanggalInput: formatTanggal(r[11]),
          dokumen: {}
        }
        // Baca kolom per jenis dokumen
        let col = 12
        for (const j of JENIS_DOKUMEN_LIST) {
          const namaFile = String(r[col]||'')
          const urlDrive = String(r[col+1]||'')
          if (namaFile || urlDrive) {
            obj.dokumen[j] = { namaFile, urlDrive }
          }
          col += 2
        }
        // Backward compat: set jenisDokumen & namaFile dari dokumen pertama yang ada
        const firstJenis = Object.keys(obj.dokumen)[0]
        if (firstJenis) {
          obj.jenisDokumen = firstJenis
          obj.namaFile = obj.dokumen[firstJenis].namaFile
          obj.fileUrlDrive = obj.dokumen[firstJenis].urlDrive
        }
        return obj
      }).filter(r => r.nama)

      return jsonResponse({ success: true, rows })
    } catch(err) {
      return jsonResponse({ success: false, error: err.message })
    }
  }
  return jsonResponse({ status: 'ok', message: 'GAS aktif' })
}

function handleUploadRow(payload) {
  const row = payload.rowData
  const dokumen = payload.dokumen || {}   // { "Ijazah SD": { base64, fileName }, ... }
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)
  const sheet = getOrCreateMasterSheet(rootFolder)

  // Upload tiap file per jenis dokumen
  const uploadedDocs = {}
  for (const jenis of JENIS_DOKUMEN_LIST) {
    if (dokumen[jenis] && dokumen[jenis].base64) {
      const sub = getOrCreateFolder(rootFolder, jenis)
      const file = uploadBase64File(dokumen[jenis].base64, dokumen[jenis].fileName, sub)
      uploadedDocs[jenis] = { namaFile: dokumen[jenis].fileName, urlDrive: file.getUrl() }
    } else if (dokumen[jenis] && dokumen[jenis].namaFile) {
      uploadedDocs[jenis] = { namaFile: dokumen[jenis].namaFile, urlDrive: '' }
    }
  }

  // Backward compat: jika pakai fileBase64 tunggal lama
  if (payload.fileBase64 && payload.fileName && row.jenisDokumen) {
    const sub = getOrCreateFolder(rootFolder, row.jenisDokumen)
    const file = uploadBase64File(payload.fileBase64, payload.fileName, sub)
    uploadedDocs[row.jenisDokumen] = { namaFile: payload.fileName, urlDrive: file.getUrl() }
  }

  // Bangun baris
  const newRow = buildSheetRow(row, uploadedDocs)
  sheet.appendRow(newRow)
  return { success: true }
}

function handleUploadBulk(payload) {
  const rows = payload.rows || []
  if (!rows.length) return { success: false, error: 'Tidak ada data' }
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)
  const sheet = getOrCreateMasterSheet(rootFolder)

  const newRows = rows.map(r => {
    // Untuk bulk import dari Excel, hanya ada 1 jenis dokumen per baris
    const dokumen = {}
    if (r.jenisDokumen && r.namaFile) {
      dokumen[r.jenisDokumen] = { namaFile: r.namaFile, urlDrive: '' }
    }
    return buildSheetRow(r, dokumen)
  })
  sheet.getRange(sheet.getLastRow()+1, 1, newRows.length, getFullHeaders().length).setValues(newRows)
  return { success: true, count: rows.length }
}

function handleUpdateRow(payload) {
  const row = payload.rowData
  const dokumen = payload.dokumen || {}
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)
  const sheet = getOrCreateMasterSheet(rootFolder)
  const lastRow = sheet.getLastRow()
  if (lastRow <= 1) return { success: false, error: 'Data tidak ditemukan' }

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues()
  let targetRow = -1
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(row.id)) { targetRow = i + 2; break }
  }
  if (targetRow === -1) return { success: false, error: 'ID tidak ditemukan: ' + row.id }

  // Baca data dokumen lama dari baris existing
  const headers = getFullHeaders()
  const existingVals = sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0]
  const existingDocs = {}
  let col = 12
  for (const j of JENIS_DOKUMEN_LIST) {
    const namaFile = String(existingVals[col]||'')
    const urlDrive = String(existingVals[col+1]||'')
    if (namaFile || urlDrive) existingDocs[j] = { namaFile, urlDrive }
    col += 2
  }

  // Merge dokumen lama dengan dokumen baru
  const mergedDocs = { ...existingDocs }
  for (const jenis of JENIS_DOKUMEN_LIST) {
    if (dokumen[jenis] && dokumen[jenis].base64) {
      const sub = getOrCreateFolder(rootFolder, jenis)
      const file = uploadBase64File(dokumen[jenis].base64, dokumen[jenis].fileName, sub)
      mergedDocs[jenis] = { namaFile: dokumen[jenis].fileName, urlDrive: file.getUrl() }
    }
  }

  const updatedRow = buildSheetRow(row, mergedDocs)
  sheet.getRange(targetRow, 1, 1, headers.length).setValues([updatedRow])
  return { success: true }
}

function handleDeleteRow(payload) {
  const rowId = payload.id
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)
  const sheet = getOrCreateMasterSheet(rootFolder)
  const lastRow = sheet.getLastRow()
  if (lastRow <= 1) return { success: false, error: 'Data tidak ditemukan' }

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues()
  let targetRow = -1
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(rowId)) { targetRow = i + 2; break }
  }
  if (targetRow === -1) return { success: false, error: 'ID tidak ditemukan' }

  // Hapus file di Drive berdasarkan URL yang tersimpan
  const headers = getFullHeaders()
  const rowVals = sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0]
  let col = 12
  for (const j of JENIS_DOKUMEN_LIST) {
    const urlDrive = String(rowVals[col+1]||'')
    if (urlDrive) {
      try {
        const fileId = extractFileIdFromUrl(urlDrive)
        if (fileId) DriveApp.getFileById(fileId).setTrashed(true)
      } catch(e) { /* abaikan jika file sudah terhapus */ }
    }
    col += 2
  }

  sheet.deleteRow(targetRow)
  return { success: true }
}

function buildSheetRow(row, uploadedDocs) {
  const base = [
    row.id||'', row.nama||'', row.nis||'', row.nisn||'', row.jk||'',
    row.tempatLahir||'', row.tanggalLahir||'', row.agama||'', row.alamat||'',
    row.sekolahAsal||'', row.keterangan||'',
    row.tanggalInput||new Date().toLocaleDateString('id-ID')
  ]
  for (const j of JENIS_DOKUMEN_LIST) {
    const d = uploadedDocs[j]
    base.push(d ? d.namaFile : '')
    base.push(d ? d.urlDrive : '')
  }
  return base
}

function extractFileIdFromUrl(url) {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (m) return m[1]
  const m2 = url.match(/id=([a-zA-Z0-9_-]+)/)
  if (m2) return m2[1]
  return null
}

function getOrCreateFolder(parent, name) {
  const it = parent.getFoldersByName(name)
  return it.hasNext() ? it.next() : parent.createFolder(name)
}

function getOrCreateMasterSheet(rootFolder) {
  const it = rootFolder.getFilesByName(MASTER_FILE_NAME)
  let ss
  if (it.hasNext()) {
    ss = SpreadsheetApp.open(it.next())
  } else {
    ss = SpreadsheetApp.create(MASTER_FILE_NAME)
    const f = DriveApp.getFileById(ss.getId())
    rootFolder.addFile(f)
    DriveApp.getRootFolder().removeFile(f)
    const sh = ss.getActiveSheet()
    sh.setName('Data Siswa')
    const headers = getFullHeaders()
    sh.appendRow(headers)
    sh.getRange(1,1,1,headers.length).setFontWeight('bold')
    sh.setFrozenRows(1)
    sh.hideColumns(1)
  }
  return ss.getActiveSheet()
}

function uploadBase64File(b64, fileName, folder) {
  const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'application/pdf', fileName)
  const ex = folder.getFilesByName(fileName)
  while(ex.hasNext()) ex.next().setTrashed(true)
  return folder.createFile(blob)
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
