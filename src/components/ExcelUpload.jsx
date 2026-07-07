import { parseExcel } from '../utils/excelParser'

export default function ExcelUpload({ onData, label = 'Upload Excel' }) {
  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const rows = await parseExcel(file)
      onData(rows)
    } catch (err) {
      alert('Gagal membaca file Excel. Pastikan format file benar (.xlsx / .xls / .csv).')
      console.error(err)
    }
    e.target.value = ''
  }

  return (
    <label className="cursor-pointer inline-flex items-center bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition">
      {label}
      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
    </label>
  )
}
