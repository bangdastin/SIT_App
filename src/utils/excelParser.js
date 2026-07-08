import * as XLSX from 'xlsx'

/**
 * Parse file Excel dengan deteksi header otomatis.
 * Mendukung:
 * - File dapodik (baris 1 = nomor kolom, baris 2 = nama kolom)
 * - File normal (baris 1 = nama kolom langsung)
 *
 * Return: Promise<Array<Object>> — array of plain objects keyed by header name
 */
export function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (evt) => {
      try {
        const wb  = XLSX.read(evt.target.result, { type: 'array' })
        const ws  = wb.Sheets[wb.SheetNames[0]]

        // Ambil semua baris sebagai array-of-arrays (tidak pakai header otomatis)
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        if (raw.length < 2) return resolve([])

        // Cari baris header: baris pertama yang kolom pertamanya bukan angka
        // dan punya nilai teks bermakna (misal "Nama", "NIS", dst)
        let headerRowIdx = 0
        for (let i = 0; i < Math.min(5, raw.length); i++) {
          const firstCell = String(raw[i][0] ?? '').trim()
          const secondCell = String(raw[i][1] ?? '').trim()
          // Baris header biasanya dimulai dengan "No" atau kolom teks bermakna
          if (
            firstCell.toLowerCase() === 'no' ||
            (isNaN(Number(firstCell)) && firstCell !== '' && secondCell !== '')
          ) {
            headerRowIdx = i
            break
          }
        }

        const headerRow = raw[headerRowIdx].map(h => String(h ?? '').trim())
        const dataRows  = raw.slice(headerRowIdx + 1)

        const result = dataRows
          .filter(row => row.some(cell => String(cell ?? '').trim() !== '')) // skip baris kosong
          .map(row => {
            const obj = {}
            headerRow.forEach((header, idx) => {
              if (header) obj[header] = String(row[idx] ?? '').trim()
            })
            return obj
          })

        resolve(result)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}
