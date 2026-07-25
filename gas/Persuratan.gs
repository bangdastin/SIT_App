// ══════════════════════════════════════════════════════════════════
// Google Apps Script — Persuratan
// SIT Terpadu | SMPN 82 Jakarta
//
// CARA SETUP:
//  1. Buka https://script.google.com → New Project
//  2. Paste seluruh kode ini, ganti ROOT_FOLDER_ID dengan ID folder Drive Anda
//  3. Klik Deploy → New Deployment → Web App
//     - Execute as : Me
//     - Who has access : Anyone
//  4. Copy Web App URL → isi di .env → VITE_GAS_PERSURATAN_URL=<url>
//  5. Jalankan setupSheet() SEKALI via Run di editor untuk inisialisasi
// ══════════════════════════════════════════════════════════════════

const ROOT_FOLDER_ID   = '1C4lyg28fpYTC3hRhTJULRQpacqu8NlqK'
const MASTER_FILE_NAME = 'Data_Persuratan'

const KATEGORI_SURAT = ['Surat Masuk', 'Surat Keluar']

// Persuratan: banyak file per baris, disimpan sebagai JSON string
const HEADERS = ['ID', 'Kategori Surat', 'Tahun', 'Dokumen JSON', 'Tanggal Input']

// ── ROUTING ────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents)
    let result
    if      (payload.action === 'uploadRow')  result = handleUploadRow(payload)
    else if (payload.action === 'updateRow')  result = handleUpdateRow(payload)
    else if (payload.action === 'deleteRow')  result = handleDeleteRow(payload)
    else result = { success: false, error: 'Action tidak dikenal' }
    return jsonResponse(result)
  } catch (err) {
    return jsonResponse({ success: false, error: err.message })
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'getData') {
    try {
      const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)
      const sheet = getOrCreateMasterSheet(rootFolder)
      const lastRow = sheet.getLastRow()
      if (lastRow <= 1) return jsonResponse({ success: true, rows: [] })

      const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues()
      const rows = values.map(r => {
        let dokumen = []
        try { dokumen = JSON.parse(String(r[3] || '[]')) } catch(e) {}
        return {
          id:           String(r[0] || ''),
          kategori:     String(r[1] || ''),
          tahun:        String(r[2] || ''),
          dokumen,
          tanggalInput: String(r[4] || ''),
        }
      }).filter(r => r.kategori)

      return jsonResponse({ success: true, rows })
    } catch (err) {
      return jsonResponse({ success: false, error: err.message })
    }
  }
  return jsonResponse({ status: 'ok', message: 'GAS Persuratan aktif' })
}

// ── HANDLERS ───────────────────────────────────────────────────────
function handleUploadRow(payload) {
  const row   = payload.rowData
  const files = payload.files || []    // [{ fileName, base64 }]
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)
  const sheet = getOrCreateMasterSheet(rootFolder)

  // Sub-folder per kategori surat + tahun
  const folderName = `${row.kategori || 'Surat'} ${row.tahun || ''}`
  const subFolder  = getOrCreateFolder(rootFolder, folderName)
  const dokumen    = []

  for (const f of files) {
    if (!f.base64) continue
    const file = uploadBase64File(f.base64, f.fileName, subFolder)
    dokumen.push({ namaFile: f.fileName, urlDrive: file.getUrl() })
  }

  // Fallback dari rowData.dokumen jika tidak ada base64 (import Excel)
  if (dokumen.length === 0 && Array.isArray(row.dokumen)) {
    for (const d of row.dokumen) {
      dokumen.push({ namaFile: d.namaFile || '', urlDrive: d.urlDrive || '' })
    }
  }

  sheet.appendRow([
    row.id          || '',
    row.kategori    || '',
    row.tahun       || '',
    JSON.stringify(dokumen),
    row.tanggalInput || new Date().toLocaleDateString('id-ID')
  ])
  return { success: true }
}

function handleUpdateRow(payload) {
  const row   = payload.rowData
  const files = payload.files || []
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)
  const sheet = getOrCreateMasterSheet(rootFolder)

  const targetRow = findRowById(sheet, row.id)
  if (targetRow === -1) return { success: false, error: 'ID tidak ditemukan: ' + row.id }

  // Baca dokumen lama
  const existingVals = sheet.getRange(targetRow, 1, 1, HEADERS.length).getValues()[0]
  let existingDocs = []
  try { existingDocs = JSON.parse(String(existingVals[3] || '[]')) } catch(e) {}

  // Upload file baru & append
  const folderName = `${row.kategori || 'Surat'} ${row.tahun || ''}`
  const subFolder  = getOrCreateFolder(rootFolder, folderName)
  for (const f of files) {
    if (!f.base64) continue
    const file = uploadBase64File(f.base64, f.fileName, subFolder)
    existingDocs.push({ namaFile: f.fileName, urlDrive: file.getUrl() })
  }

  // Gunakan dokumen dari payload (berisi state terbaru dari frontend)
  const finalDocs = Array.isArray(row.dokumen) ? row.dokumen.map(d => ({
    namaFile: d.namaFile || '',
    urlDrive: d.urlDrive || existingDocs.find(e => e.namaFile === d.namaFile)?.urlDrive || ''
  })) : existingDocs

  sheet.getRange(targetRow, 1, 1, HEADERS.length).setValues([[
    row.id          || '',
    row.kategori    || '',
    row.tahun       || '',
    JSON.stringify(finalDocs),
    row.tanggalInput || new Date().toLocaleDateString('id-ID')
  ]])
  return { success: true }
}

function handleDeleteRow(payload) {
  const rowId = payload.id
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)
  const sheet = getOrCreateMasterSheet(rootFolder)

  const targetRow = findRowById(sheet, rowId)
  if (targetRow === -1) return { success: false, error: 'ID tidak ditemukan' }

  // Hapus semua file Drive
  const rowVals = sheet.getRange(targetRow, 1, 1, HEADERS.length).getValues()[0]
  let docs = []
  try { docs = JSON.parse(String(rowVals[3] || '[]')) } catch(e) {}
  for (const d of docs) {
    if (d.urlDrive) trashDriveFile(d.urlDrive)
  }

  sheet.deleteRow(targetRow)
  return { success: true }
}

// ── HELPERS ────────────────────────────────────────────────────────
function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow()
  if (lastRow <= 1) return -1
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues()
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2
  }
  return -1
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
    sh.setName('Data Surat')
    sh.appendRow(HEADERS)
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold')
    sh.setFrozenRows(1)
    sh.hideColumns(1)
    // Kolom Dokumen JSON plain text
    sh.getRange(2, 4, sh.getMaxRows() - 1, 1).setNumberFormat('@STRING@')
  }
  return ss.getActiveSheet()
}

function uploadBase64File(b64, fileName, folder) {
  const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'application/pdf', fileName)
  const ex = folder.getFilesByName(fileName)
  while (ex.hasNext()) ex.next().setTrashed(true)
  return folder.createFile(blob)
}

function trashDriveFile(url) {
  try {
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
    const id = m ? m[1] : url.match(/id=([a-zA-Z0-9_-]+)/)?.[1]
    if (id) DriveApp.getFileById(id).setTrashed(true)
  } catch (e) { /* abaikan */ }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}

/**
 * Jalankan SEKALI via GAS editor (Run → setupSheet) untuk inisialisasi
 * spreadsheet dan sub-folder Drive per kategori surat.
 */
function setupSheet() {
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)

  // Buat sub-folder per kategori
  for (const k of KATEGORI_SURAT) getOrCreateFolder(rootFolder, k)

  const sheet = getOrCreateMasterSheet(rootFolder)
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold')
  sheet.setFrozenRows(1)
  sheet.getRange(2, 4, sheet.getMaxRows() - 1, 1).setNumberFormat('@STRING@')
  Logger.log('Setup Persuratan selesai. Spreadsheet: ' + MASTER_FILE_NAME)
}
