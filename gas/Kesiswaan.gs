/**
 * Google Apps Script - Kesiswaan
 * 
 * Struktur folder di Google Drive:
 * My Drive/
 *   KESISWAAN/
 *     Data_Kesiswaan.xlsx         ← 1 file master semua data
 *     Ijazah jenjang sebelumnya dan SMP/
 *       [file PDF siswa]
 *     Akte/
 *     Kartu Keluarga/
 *     Nilai Raport/
 *     Nilai Sidanira/
 * 
 * CARA DEPLOY:
 * 1. Buka https://script.google.com → New project
 * 2. Paste seluruh kode ini, ganti SPREADSHEET_ID jika sudah punya spreadsheet master
 * 3. Deploy → New deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Salin URL yang muncul → paste ke .env sebagai VITE_GAS_KESISWAAN_URL
 */

// ─── Konfigurasi ──────────────────────────────────────────────────────────────
const ROOT_FOLDER_ID    = '14n26CyPHcq4u9Vo3cQkA2a9nvGTvv5ih'  // Folder Drive SIT Terpadu
const MASTER_FILE_NAME  = 'Data_Kesiswaan'

const SHEET_HEADERS = [
  'ID', 'Nama Murid', 'NIS', 'NISN', 'JK', 'Tempat Lahir',
  'Tanggal Lahir', 'Agama', 'Alamat', 'Sekolah Asal',
  'Jenis Dokumen', 'Keterangan', 'Nama File', 'URL Drive', 'Tanggal Input'
]

// ─── Entry Point ──────────────────────────────────────────────────────────────
function doPost(e) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  }

  try {
    const payload = JSON.parse(e.postData.contents)
    let result

    if (payload.action === 'uploadRow') {
      result = handleUploadRow(payload)
    } else if (payload.action === 'uploadBulk') {
      result = handleUploadBulk(payload)
    } else {
      result = { success: false, error: 'Action tidak dikenal: ' + payload.action }
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON)
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Kesiswaan GAS aktif' }))
    .setMimeType(ContentService.MimeType.JSON)
}

// ─── Handler: Upload 1 baris + file PDF ───────────────────────────────────────
function handleUploadRow(payload) {
  const row       = payload.rowData
  const b64       = payload.fileBase64
  const fileName  = payload.fileName

  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)
  const sheet      = getOrCreateMasterSheet(rootFolder)

  let fileUrl = ''
  if (b64 && fileName) {
    const jenisDok  = row.jenisDokumen || 'Lainnya'
    const subFolder = getOrCreateFolder(rootFolder, jenisDok)
    const pdfFile   = uploadBase64File(b64, fileName, subFolder)
    fileUrl = pdfFile.getUrl()
  }

  sheet.appendRow([
    row.id || '',
    row.nama || '',
    row.nis || '',
    row.nisn || '',
    row.jk || '',
    row.tempatLahir || '',
    row.tanggalLahir || '',
    row.agama || '',
    row.alamat || '',
    row.sekolahAsal || '',
    row.jenisDokumen || '',
    row.keterangan || '',
    row.namaFile || fileName || '',
    fileUrl,
    row.tanggalInput || new Date().toLocaleDateString('id-ID')
  ])

  return { success: true, fileUrl }
}

// ─── Handler: Upload bulk dari Excel (tanpa file PDF) ─────────────────────────
function handleUploadBulk(payload) {
  const rows = payload.rows || []
  if (!rows.length) return { success: false, error: 'Tidak ada data' }

  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)
  const sheet      = getOrCreateMasterSheet(rootFolder)

  const JENIS_DOKUMEN = ['Ijazah SD', 'Ijazah SMP', 'Akte', 'Kartu Keluarga', 'Nilai Rapor', 'SKP']
  JENIS_DOKUMEN.forEach(j => getOrCreateFolder(rootFolder, j))

  const newRows = rows.map(row => [
    row.id || '',
    row.nama || '',
    row.nis || '',
    row.nisn || '',
    row.jk || '',
    row.tempatLahir || '',
    row.tanggalLahir || '',
    row.agama || '',
    row.alamat || '',
    row.sekolahAsal || '',
    row.jenisDokumen || '',
    row.keterangan || '',
    row.namaFile || '',
    '',
    row.tanggalInput || new Date().toLocaleDateString('id-ID')
  ])

  if (newRows.length > 0) {
    const lastRow = sheet.getLastRow() + 1
    sheet.getRange(lastRow, 1, newRows.length, SHEET_HEADERS.length).setValues(newRows)
  }

  return { success: true, count: rows.length }
}

/** Ambil atau buat folder berdasarkan nama di dalam parentFolder */
function getOrCreateFolder(parentFolder, name) {
  const iter = parentFolder.getFoldersByName(name)
  if (iter.hasNext()) return iter.next()
  return parentFolder.createFolder(name)
}

/**
 * Ambil atau buat Spreadsheet master "Data_Kesiswaan" di dalam rootFolder.
 */
function getOrCreateMasterSheet(rootFolder) {
  const iter = rootFolder.getFilesByName(MASTER_FILE_NAME)
  let ss

  if (iter.hasNext()) {
    ss = SpreadsheetApp.open(iter.next())
    const sheet = ss.getActiveSheet()
    if (!sheet.isColumnHiddenByUser(1)) sheet.hideColumns(1)
  } else {
    ss = SpreadsheetApp.create(MASTER_FILE_NAME)
    const file = DriveApp.getFileById(ss.getId())
    rootFolder.addFile(file)
    DriveApp.getRootFolder().removeFile(file)

    const sheet = ss.getActiveSheet()
    sheet.setName('Data Siswa')
    sheet.appendRow(SHEET_HEADERS)
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setFontWeight('bold')
    sheet.setFrozenRows(1)
    sheet.hideColumns(1)
  }

  return ss.getActiveSheet()
}

/** Upload file dari base64 string ke subfolder Drive */
function uploadBase64File(base64String, fileName, folder) {
  const decoded = Utilities.base64Decode(base64String)
  const blob    = Utilities.newBlob(decoded, 'application/pdf', fileName)
  const existing = folder.getFilesByName(fileName)
  while (existing.hasNext()) existing.next().setTrashed(true)
  return folder.createFile(blob)
}
