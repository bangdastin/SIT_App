const ROOT_FOLDER_ID   = '14n26CyPHcq4u9Vo3cQkA2a9nvGTvv5ih'
const MASTER_FILE_NAME = 'Data_Kesiswaan'
const SHEET_HEADERS = [
  'ID','Nama Murid','NIS','NISN','JK','Tempat Lahir',
  'Tanggal Lahir','Agama','Alamat','Sekolah Asal',
  'Jenis Dokumen','Keterangan','Nama File','URL Drive','Tanggal Input'
]

/** Format tanggal apapun jadi dd/mm/yyyy */
function formatTanggal(val) {
  if (!val) return ''
  const s = String(val)
  // Kalau sudah format dd/mm/yyyy atau dd-mm-yyyy, kembalikan apa adanya
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s)) return s.replace(/-/g, '/')
  // Kalau format yyyy-mm-dd (ISO)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s)
    if (!isNaN(d)) return d.toLocaleDateString('id-ID')
  }
  // Kalau Date object / string panjang
  const d = new Date(val)
  if (!isNaN(d)) return d.toLocaleDateString('id-ID')
  return s
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents)
    let result
    if (payload.action === 'uploadRow')       result = handleUploadRow(payload)
    else if (payload.action === 'uploadBulk') result = handleUploadBulk(payload)
    else if (payload.action === 'updateRow')  result = handleUpdateRow(payload)
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
      if (lastRow <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ success: true, rows: [] }))
          .setMimeType(ContentService.MimeType.JSON)
      }
      const values = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS.length).getValues()
      const rows = values.map(r => ({
        id:           String(r[0] || ''),
        nama:         String(r[1] || ''),
        nis:          String(r[2] || ''),
        nisn:         String(r[3] || ''),
        jk:           String(r[4] || ''),
        tempatLahir:  String(r[5] || ''),
        tanggalLahir: formatTanggal(r[6]),
        agama:        String(r[7] || ''),
        alamat:       String(r[8] || ''),
        sekolahAsal:  String(r[9] || ''),
        jenisDokumen: String(r[10] || ''),
        keterangan:   String(r[11] || ''),
        namaFile:     String(r[12] || ''),
        fileUrlDrive: String(r[13] || ''),
        tanggalInput: formatTanggal(r[14]),
      })).filter(r => r.nama)
      return ContentService.createTextOutput(JSON.stringify({ success: true, rows }))
        .setMimeType(ContentService.MimeType.JSON)
    } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
        .setMimeType(ContentService.MimeType.JSON)
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'GAS aktif' }))
    .setMimeType(ContentService.MimeType.JSON)
}

function handleUploadRow(payload) {
  const row = payload.rowData
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)
  const sheet = getOrCreateMasterSheet(rootFolder)
  let fileUrl = ''
  if (payload.fileBase64 && payload.fileName) {
    const sub = getOrCreateFolder(rootFolder, row.jenisDokumen || 'Lainnya')
    fileUrl = uploadBase64File(payload.fileBase64, payload.fileName, sub).getUrl()
  }
  sheet.appendRow([
    row.id||'', row.nama||'', row.nis||'', row.nisn||'', row.jk||'',
    row.tempatLahir||'', row.tanggalLahir||'', row.agama||'', row.alamat||'',
    row.sekolahAsal||'', row.jenisDokumen||'', row.keterangan||'',
    row.namaFile||payload.fileName||'', fileUrl,
    row.tanggalInput||new Date().toLocaleDateString('id-ID')
  ])
  return { success: true, fileUrl }
}

function handleUploadBulk(payload) {
  const rows = payload.rows || []
  if (!rows.length) return { success: false, error: 'Tidak ada data' }
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)
  const sheet = getOrCreateMasterSheet(rootFolder)
  const newRows = rows.map(r => [
    r.id||'', r.nama||'', r.nis||'', r.nisn||'', r.jk||'',
    r.tempatLahir||'', r.tanggalLahir||'', r.agama||'', r.alamat||'',
    r.sekolahAsal||'', r.jenisDokumen||'', r.keterangan||'',
    r.namaFile||'', '', r.tanggalInput||new Date().toLocaleDateString('id-ID')
  ])
  sheet.getRange(sheet.getLastRow()+1, 1, newRows.length, SHEET_HEADERS.length).setValues(newRows)
  return { success: true, count: rows.length }
}

function handleUpdateRow(payload) {
  const row = payload.rowData
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)
  const sheet = getOrCreateMasterSheet(rootFolder)
  const lastRow = sheet.getLastRow()
  if (lastRow <= 1) return { success: false, error: 'Data tidak ditemukan' }

  // Cari baris berdasarkan ID (kolom 1)
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues()
  let targetRow = -1
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(row.id)) { targetRow = i + 2; break }
  }
  if (targetRow === -1) return { success: false, error: 'ID tidak ditemukan: ' + row.id }

  // Upload file baru jika ada
  let fileUrl = row.fileUrlDrive || ''
  if (payload.fileBase64 && payload.fileName) {
    const sub = getOrCreateFolder(rootFolder, row.jenisDokumen || 'Lainnya')
    fileUrl = uploadBase64File(payload.fileBase64, payload.fileName, sub).getUrl()
  }

  // Update baris
  sheet.getRange(targetRow, 1, 1, SHEET_HEADERS.length).setValues([[
    row.id||'', row.nama||'', row.nis||'', row.nisn||'', row.jk||'',
    row.tempatLahir||'', row.tanggalLahir||'', row.agama||'', row.alamat||'',
    row.sekolahAsal||'', row.jenisDokumen||'', row.keterangan||'',
    row.namaFile||payload.fileName||'', fileUrl,
    row.tanggalInput||new Date().toLocaleDateString('id-ID')
  ]])
  return { success: true, fileUrl }
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
    sh.appendRow(SHEET_HEADERS)
    sh.getRange(1,1,1,SHEET_HEADERS.length).setFontWeight('bold')
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
