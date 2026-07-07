/**
 * Inline PDF viewer menggunakan iframe.
 * src: base64 data URL dari file PDF
 */
export default function DocViewer({ src, fileName }) {
  if (!src) return null

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
      <iframe
        src={src}
        title={fileName || 'Dokumen'}
        className="w-full"
        style={{ height: '480px' }}
      />
    </div>
  )
}
