/**
 * IndexedDB wrapper untuk menyimpan file PDF (sebagai ArrayBuffer).
 * Tidak ada batas ukuran praktis (bisa ratusan MB tergantung disk).
 * Data persisten setelah refresh / tutup browser.
 */

const DB_NAME    = 'sit_files'
const DB_VERSION = 1
const STORE_NAME = 'files'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror   = (e) => reject(e.target.error)
  })
}

/** Simpan File object ke IndexedDB dengan key = rowId */
export async function saveFile(rowId, file) {
  const buffer = await file.arrayBuffer()
  const db     = await openDB()
  return new Promise((resolve, reject) => {
    const tx   = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put({ id: rowId, name: file.name, type: file.type, buffer })
    tx.oncomplete = resolve
    tx.onerror    = (e) => reject(e.target.error)
  })
}

/** Ambil file dari IndexedDB, kembalikan sebagai object URL (atau null) */
export async function getFileURL(rowId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.get(rowId)
    req.onsuccess = (e) => {
      const rec = e.target.result
      if (!rec) return resolve(null)
      const blob = new Blob([rec.buffer], { type: rec.type || 'application/pdf' })
      resolve(URL.createObjectURL(blob))
    }
    req.onerror = (e) => reject(e.target.error)
  })
}

/** Hapus file dari IndexedDB */
export async function deleteFile(rowId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete(rowId)
    tx.oncomplete = resolve
    tx.onerror    = (e) => reject(e.target.error)
  })
}
