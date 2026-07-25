// ══════════════════════════════════════════════════════════════════
// Google Apps Script — Kepegawaian
// SIT Terpadu | SMPN 82 Jakarta
//
// CARA SETUP:
//  1. Buka https://script.google.com → New Project
//  2. Paste seluruh kode ini, ganti ROOT_FOLDER_ID dengan ID folder Drive Anda
//  3. Klik Deploy → New Deployment → Web App
//     - Execute as : Me
//     - Who has access : Anyone
//  4. Copy Web App URL → isi di .env → VITE_GAS_KEPEGAWAIAN_URL=<url>
//  5. Jalankan setupSheet() SEKALI via Run di editor untuk inisialisasi
// ══════════════════════════════════════════════════════════════════

const ROOT_FOLDER_ID   = '1C4lyg28fpYTC3hRhTJULRQpacqu8NlqK'
const MASTER_FILE_NAME = 'Data_Kepegawaian'

const KATEGORI_LIST = ['Dokumen Pribadi', 'Dokumen Kepegawaian', 'Dokumen Absensi', 'SKP']

// Header dasar pegawai
const BASE_HEADERS = [
  'ID', 'Nama Pegawai', 'NIP/NRK', 'Kategori', 'Keterangan', 'Tanggal Input'
]

// Header lengkap: base + 2 kolom per kategori (nama file + url)
function getFullHeaders() {
  const h = [...BASE_HEADERS]
  for (const k of KATEGORI_LIST) {
    h.push(`File ${k}`)
    h.push(`URL ${k}`)
  }
  return h
}

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

      const headers = getFullHeaders()
      const values  = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues()

      const rows = values.map(r => {
        const obj = {
          id:           String(r[0] || ''),
          nama:         String(r[1] || ''),
          nipnik:       String(r[2] || ''),
          kategori:     String(r[3] || ''),
          keterangan:   String(r[4] || ''),
          tanggalInput: String(r[5] || ''),
          dokumen: {}
        }
        let col = 6
        for (const k of KATEGORI_LIST) {
          const namaFile = sanitizeStr(r[col])
          const urlDrive = sanitizeStr(r[col + 1])
          if (namaFile || urlDrive) obj.dokumen[k] = { namaFile, urlDrive }
          col += 2
        }
        return obj
      }).filter(r => r.nama)

      return jsonResponse({ success: true, rows })
    } catch (err) {
      return jsonResponse({ success: false, error: err.message })
    }
  }
  return jsonResponse({ status: 'ok', message: 'GAS Kepegawaian aktif' })
}

// ── HANDLERS ───────────────────────────────────────────────────────
function handleUploadRow(payload) {
  const row    = payload.rowData
  const dokumen = payload.dokumen || {}   // { "Dokumen Pribadi": { base64, fileName }, ... }
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)
  const sheet  = getOrCreateMasterSheet(rootFolder)

  const uploadedDocs = {}
  for (const kat of KATEGORI_LIST) {
    const d = dokumen[kat]
    if (d && d.base64) {
      const sub  = getOrCreateFolder(rootFolder, kat)
      const file = uploadBase64File(d.base64, d.fileName, sub)
      uploadedDocs[kat] = { namaFile: d.fileName, urlDrive: file.getUrl() }
    } else if (d && d.namaFile) {
      uploadedDocs[kat] = { namaFile: d.namaFile, urlDrive: '' }
    }
  }

  sheet.appendRow(buildSheetRow(row, uploadedDocs))
  return { success: true }
}

function handleUpdateRow(payload) {
  const row     = payload.rowData
  const dokumen = payload.dokumen || {}
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)
  const sheet   = getOrCreateMasterSheet(rootFolder)

  const targetRow = findRowById(sheet, row.id)
  if (targetRow === -1) return { success: false, error: 'ID tidak ditemukan: ' + row.id }

  // Baca dokumen lama
  const headers  = getFullHeaders()
  const existing = sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0]
  const mergedDocs = {}
  let col = 6
  for (const k of KATEGORI_LIST) {
    const namaFile = sanitizeStr(existing[col])
    const urlDrive = sanitizeStr(existing[col + 1])
    if (namaFile || urlDrive) mergedDocs[k] = { namaFile, urlDrive }
    col += 2
  }

  // Upload dokumen baru & merge
  for (const kat of KATEGORI_LIST) {
    const d = dokumen[kat]
    if (d && d.base64) {
      const sub  = getOrCreateFolder(rootFolder, kat)
      const file = uploadBase64File(d.base64, d.fileName, sub)
      mergedDocs[kat] = { namaFile: d.fileName, urlDrive: file.getUrl() }
    }
  }

  sheet.getRange(targetRow, 1, 1, headers.length).setValues([buildSheetRow(row, mergedDocs)])
  return { success: true }
}

function handleDeleteRow(payload) {
  const rowId = payload.id
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)
  const sheet = getOrCreateMasterSheet(rootFolder)

  const targetRow = findRowById(sheet, rowId)
  if (targetRow === -1) return { success: false, error: 'ID tidak ditemukan' }

  // Hapus file Drive
  const headers = getFullHeaders()
  const rowVals = sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0]
  let col = 6
  for (const k of KATEGORI_LIST) {
    const url = sanitizeStr(rowVals[col + 1])
    if (url) trashDriveFile(url)
    col += 2
  }

  sheet.deleteRow(targetRow)
  return { success: true }
}

// ── HELPERS ────────────────────────────────────────────────────────
function buildSheetRow(row, uploadedDocs) {
  const base = [
    row.id          || '',
    row.nama        || '',
    row.nipnik      || '',
    row.kategori    || '',
    row.keterangan  || '',
    row.tanggalInput || new Date().toLocaleDateString('id-ID')
  ]
  for (const k of KATEGORI_LIST) {
    const d = uploadedDocs[k]
    base.push(d ? d.namaFile : '')
    base.push(d ? d.urlDrive : '')
  }
  return base
}

function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow()
  if (lastRow <= 1) return -1
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues()
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2
  }
  return -1
}

function sanitizeStr(val) {
  if (val instanceof Date) return ''
  return String(val || '').trim()
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
    sh.setName('Data Pegawai')
    const headers = getFullHeaders()
    sh.appendRow(headers)
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold')
    sh.setFrozenRows(1)
    sh.hideColumns(1)
    // Kolom file/url sebagai plain text
    for (let i = 7; i <= headers.length; i++) {
      sh.getRange(2, i, sh.getMaxRows() - 1, 1).setNumberFormat('@STRING@')
    }
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
 * spreadsheet dan folder Drive.
 */
function setupSheet() {
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID)

  // Buat sub-folder per kategori
  for (const k of KATEGORI_LIST) getOrCreateFolder(rootFolder, k)

  const sheet = getOrCreateMasterSheet(rootFolder)
  const headers = getFullHeaders()
  // Reset header baris 1
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold')
  sheet.setFrozenRows(1)
  for (let i = 7; i <= headers.length; i++) {
    sheet.getRange(2, i, sheet.getMaxRows() - 1, 1).setNumberFormat('@STRING@')
  }
  Logger.log('Setup Kepegawaian selesai. Spreadsheet: ' + MASTER_FILE_NAME)
}
